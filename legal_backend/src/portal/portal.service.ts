import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { resolveAppUrl } from '@/common/app-url';
import { getCountryConfig } from '@/config/countries';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import { StripeService } from '@/payments/stripe.service';
import { CreatePortalDocumentRequestDto } from './dto/create-document-request.dto';
import { CreatePortalMessageDto } from './dto/create-portal-message.dto';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { UploadPortalRequestDocumentDto } from './dto/upload-request-document.dto';
import { MatterOutcomeService } from '@/matter-outcome/matter-outcome.service';
import {
  buildPortalInviteUrl,
  signPortalInviteToken,
} from './portal-invite.util';
import {
  buildPortalPaymentPath,
  signPortalPaymentToken,
  verifyPortalPaymentToken,
} from './portal-payment.util';
import { PortalRequestUser } from '@/common/guards/portal-auth.guard';

interface PortalInvitePayload {
  type: 'PORTAL_INVITE';
  clientId: string;
  tenantId: string;
  sub: string;
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly matterOutcomeService: MatterOutcomeService,
  ) {}

  getOutcomeSummary(clientId: string, tenantId: string, matterId: string) {
    return this.matterOutcomeService.getPortalOutcomeSummary(
      tenantId,
      matterId,
      clientId,
    );
  }

  async createPortalInvite(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: { tenant: { select: { name: true } } },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const inviteToken = signPortalInviteToken(
      this.jwtService,
      client.id,
      client.tenantId,
    );
    const inviteUrl = buildPortalInviteUrl(this.configService, inviteToken);

    return {
      inviteToken,
      inviteUrl,
      expiresInDays: 7,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        tenantId: client.tenantId,
        tenantName: client.tenant.name,
      },
    };
  }

  async login(dto: PortalLoginDto) {
    let payload: PortalInvitePayload;
    try {
      payload = this.jwtService.verify<PortalInvitePayload>(dto.inviteToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired portal invite link');
    }

    if (
      payload.type !== 'PORTAL_INVITE' ||
      !payload.clientId ||
      !payload.tenantId
    ) {
      throw new UnauthorizedException('Invalid portal invite link');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: payload.clientId, tenantId: payload.tenantId },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (!client) {
      throw new UnauthorizedException('Portal invite link is no longer valid');
    }

    const portalToken = this.jwtService.sign(
      {
        sub: client.id,
        clientId: client.id,
        tenantId: client.tenantId,
        email: client.email,
        type: 'PORTAL',
      },
      { expiresIn: '12h' },
    );

    return {
      portalToken,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        tenantId: client.tenantId,
        tenantName: client.tenant.name,
      },
    };
  }

  async getDashboard(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const [matters, invoices, documentRequests, messages, sharedDocuments] = await Promise.all([
      this.prisma.matter.findMany({
        where: { clientId, tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { clientId, tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.portalDocumentRequest.findMany({
        where: { clientId, tenantId },
        include: {
          matter: { select: { title: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.portalMessage.findMany({
        where: { clientId, tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.findMany({
        where: {
          tenantId,
          visibility: 'CLIENT_PORTAL',
          OR: [
            { clientId },
            {
              matter: {
                clientId,
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
      },
      matters: matters.map((m) => {
        const row = m as typeof m & {
          matterProfile?: unknown;
          matterTaskGraph?: { nextBestAction?: string } | null;
        };
        const miNextStep = row.matterTaskGraph?.nextBestAction;
        return {
          id: m.id,
          title: m.title,
          ref: m.id.slice(-8).toUpperCase(),
          status: m.status,
          stage: m.stage ?? 'Active',
          progressPercent: this.estimateMatterProgress(m.stage),
          nextStep: miNextStep ?? this.inferNextStep(m.stage),
          practiceArea: m.practiceArea,
          updatedAt: m.updatedAt.toISOString(),
          matterProfile: row.matterProfile ?? undefined,
          matterTaskGraph: row.matterTaskGraph ?? undefined,
        };
      }),
      invoices: invoices.map((inv) => this.mapInvoice(inv, client.name)),
      documentRequests: documentRequests.map((req) => ({
        id: req.id,
        title: req.title,
        matterTitle: req.matter?.title ?? 'General',
        status: this.normalizeDocumentRequestStatus(req.status, req.dueDate),
        dueDate: req.dueDate?.toISOString(),
        uploadedFileName: req.uploadedFileName ?? undefined,
      })),
      messages: messages.map((message) => ({
        id: message.id,
        subject: message.subject,
        body: message.body,
        fromFirm: message.fromFirm,
        readAt: message.readAt?.toISOString(),
        matterId: message.matterId,
        createdAt: message.createdAt.toISOString(),
      })),
      sharedDocuments: sharedDocuments.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        matterId: doc.matterId,
        updatedAt: doc.updatedAt.toISOString(),
      })),
    };
  }

  async createDocumentRequest(
    tenantId: string,
    requesterUserId: string,
    dto: CreatePortalDocumentRequestDto,
  ) {
    const relation = await this.resolveClientAndMatter(
      tenantId,
      dto.clientId,
      dto.matterId,
    );

    const request = await this.prisma.portalDocumentRequest.create({
      data: {
        tenantId,
        clientId: relation.clientId,
        matterId: relation.matterId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'pending',
        requestedById: requesterUserId,
      },
      include: {
        matter: { select: { title: true } },
      },
    });

    return {
      id: request.id,
      clientId: request.clientId,
      matterId: request.matterId,
      title: request.title,
      description: request.description,
      dueDate: request.dueDate?.toISOString(),
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      matterTitle: request.matter?.title ?? 'General',
    };
  }

  async createMessage(
    tenantId: string,
    senderUserId: string,
    dto: CreatePortalMessageDto,
  ) {
    const relation = await this.resolveClientAndMatter(
      tenantId,
      dto.clientId,
      dto.matterId,
    );

    const message = await this.prisma.portalMessage.create({
      data: {
        tenantId,
        clientId: relation.clientId,
        matterId: relation.matterId,
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        fromFirm: dto.fromFirm ?? true,
        sentById: senderUserId,
      },
    });

    return {
      id: message.id,
      clientId: message.clientId,
      matterId: message.matterId,
      subject: message.subject,
      body: message.body,
      fromFirm: message.fromFirm,
      readAt: message.readAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
    };
  }

  async uploadDocumentForRequest(
    requestId: string,
    clientId: string,
    tenantId: string,
    dto: UploadPortalRequestDocumentDto,
  ) {
    const request = await this.prisma.portalDocumentRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        clientId,
      },
    });

    if (!request) {
      throw new NotFoundException('Document request not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId,
          clientId,
          matterId: request.matterId,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          mimeType: dto.mimeType,
          visibility: 'CLIENT_PORTAL',
        },
      });

      const updatedRequest = await tx.portalDocumentRequest.update({
        where: { id: request.id },
        data: {
          status: 'uploaded',
          uploadedAt: new Date(),
          uploadedFileName: dto.fileName,
          uploadedFileUrl: dto.fileUrl,
          uploadedMimeType: dto.mimeType,
        },
      });

      return { document, updatedRequest };
    });

    return {
      request: {
        id: result.updatedRequest.id,
        status: result.updatedRequest.status,
        uploadedAt: result.updatedRequest.uploadedAt?.toISOString(),
        uploadedFileName: result.updatedRequest.uploadedFileName,
      },
      document: {
        id: result.document.id,
        fileName: result.document.fileName,
        fileUrl: result.document.fileUrl,
        createdAt: result.document.createdAt.toISOString(),
      },
    };
  }

  async listMessages(clientId: string, tenantId: string, matterId?: string) {
    const messages = await this.prisma.portalMessage.findMany({
      where: {
        clientId,
        tenantId,
        matterId: matterId || undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => ({
      id: message.id,
      clientId: message.clientId,
      matterId: message.matterId,
      subject: message.subject,
      body: message.body,
      fromFirm: message.fromFirm,
      readAt: message.readAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async markMessageRead(clientId: string, tenantId: string, messageId: string) {
    const message = await this.prisma.portalMessage.findFirst({
      where: { id: messageId, clientId, tenantId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.readAt) {
      return {
        id: message.id,
        readAt: message.readAt.toISOString(),
      };
    }

    const updated = await this.prisma.portalMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });

    return {
      id: updated.id,
      readAt: updated.readAt?.toISOString(),
    };
  }

  async createClientMessage(
    clientId: string,
    tenantId: string,
    dto: { subject: string; body: string; matterId?: string },
  ) {
    const relation = await this.resolveClientAndMatter(tenantId, clientId, dto.matterId);

    const message = await this.prisma.portalMessage.create({
      data: {
        tenantId,
        clientId: relation.clientId,
        matterId: relation.matterId,
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        fromFirm: false,
      },
    });

    return {
      id: message.id,
      clientId: message.clientId,
      matterId: message.matterId,
      subject: message.subject,
      body: message.body,
      fromFirm: message.fromFirm,
      readAt: message.readAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
    };
  }

  async getPublicInvoice(
    invoiceId: string,
    access: { payToken?: string; authHeader?: string } = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.assertInvoiceAccess(invoice, access);

    const client = invoice.clientId
      ? await this.prisma.client.findUnique({ where: { id: invoice.clientId } })
      : null;

    return this.mapInvoice(invoice, client?.name ?? 'Client');
  }

  async payInvoice(
    invoiceId: string,
    dto: PayInvoiceDto,
    access: { payToken?: string; authHeader?: string } = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.assertInvoiceAccess(invoice, access);

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new UnauthorizedException(`Invoice is already ${invoice.status.toLowerCase()}`);
    }

    const countryCode =
      dto.countryCode ??
      (invoice.clientId
        ? (
            await this.prisma.client.findUnique({
              where: { id: invoice.clientId },
              select: { countryCode: true },
            })
          )?.countryCode
        : undefined) ??
      'IN';

    const country = getCountryConfig(countryCode);
    const amount = Number(invoice.amount.toString());

    const { payment, intent } = await this.paymentsService.createPayment(
      undefined,
      invoice.tenantId,
      {
        amount,
        currency: invoice.currency,
        countryCode: country.code,
        purpose: `INVOICE_PAYMENT:${invoice.id}`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentMethod: dto.paymentMethod,
          paymentProvider: 'stripe',
        },
      },
    );

    let checkoutUrl = intent.checkoutUrl;
    if (intent.provider === 'stripe' && !checkoutUrl) {
      const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
      try {
        const session = await this.stripeService.createDynamicCheckoutSession({
          amountMinorUnits: Math.round(amount * 100),
          currency: invoice.currency,
          productName: `Invoice ${invoice.invoiceNumber}`,
          productDescription: `Payment for invoice ${invoice.invoiceNumber}`,
          mode: 'payment',
          successUrl: `${appUrl}/portal?invoice=${invoice.id}&payment=${payment.id}&status=success`,
          cancelUrl: `${appUrl}/portal?invoice=${invoice.id}&payment=${payment.id}&status=canceled`,
          metadata: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            purpose: `INVOICE_PAYMENT:${invoice.id}`,
          },
        });
        checkoutUrl = session.url;
      } catch {
        // Fall back to clientSecret flow if hosted checkout cannot be created
      }
    }

    return {
      payment: {
        id: payment.id,
        amount: Number(payment.amount.toString()),
        currency: payment.currency,
        status: payment.status,
        paymentMethod: dto.paymentMethod,
        createdAt: payment.createdAt.toISOString(),
      },
      intent: {
        provider: intent.provider,
        providerPaymentId: intent.providerPaymentId,
        clientSecret: intent.clientSecret,
        checkoutUrl,
        status: intent.status,
      },
      invoice: this.mapInvoice(invoice, 'Client'),
    };
  }

  private mapInvoice(
    invoice: {
      id: string;
      invoiceNumber: string;
      amount: Prisma.Decimal;
      currency: string;
      status: string;
      dueDate: Date | null;
      clientId: string | null;
      tenantId: string;
      createdAt: Date;
    },
    clientName: string,
  ) {
    const payToken = signPortalPaymentToken(
      this.jwtService,
      invoice.id,
      invoice.tenantId,
    );

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName,
      matterTitle: 'Legal services',
      amount: Number(invoice.amount.toString()),
      currency: invoice.currency,
      status: this.normalizeInvoiceStatus(invoice.status, invoice.dueDate),
      dueDate: (invoice.dueDate ?? invoice.createdAt).toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      paymentLink: buildPortalPaymentPath(invoice.id, payToken),
    };
  }

  private async assertInvoiceAccess(
    invoice: { id: string; clientId: string | null; tenantId: string },
    access: { payToken?: string; authHeader?: string },
  ): Promise<void> {
    const portalUser = this.extractPortalUser(access.authHeader);
    if (portalUser) {
      if (
        invoice.clientId !== portalUser.clientId ||
        invoice.tenantId !== portalUser.tenantId
      ) {
        throw new ForbiddenException('Invoice not found');
      }
      return;
    }

    if (access.payToken) {
      verifyPortalPaymentToken(this.jwtService, access.payToken, invoice.id);
      return;
    }

    throw new ForbiddenException('Payment link token required');
  }

  private extractPortalUser(authHeader?: string): PortalRequestUser | null {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return null;
    }

    try {
      const payload = this.jwtService.verify<PortalRequestUser>(token);
      if (payload.type !== 'PORTAL' || !payload.clientId || !payload.tenantId) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private normalizeInvoiceStatus(status: string, dueDate: Date | null): string {
    if (status === 'PAID' || status === 'CANCELLED') {
      return status.charAt(0) + status.slice(1).toLowerCase();
    }
    if (dueDate && dueDate < new Date() && status !== 'PAID') {
      return 'Overdue';
    }
    if (status === 'SENT') return 'Sent';
    if (status === 'DRAFT') return 'Draft';
    return status;
  }

  private normalizeDocumentRequestStatus(status: string, dueDate: Date | null) {
    if (status === 'uploaded') {
      return 'uploaded';
    }
    if (dueDate && dueDate < new Date()) {
      return 'overdue';
    }
    return 'pending';
  }

  private estimateMatterProgress(stage: string | null) {
    const normalized = (stage ?? '').toLowerCase();
    if (normalized.includes('intake')) return 15;
    if (normalized.includes('discovery')) return 40;
    if (normalized.includes('hearing') || normalized.includes('trial')) return 70;
    if (normalized.includes('settle') || normalized.includes('close')) return 100;
    return 50;
  }

  private inferNextStep(stage: string | null) {
    const normalized = (stage ?? '').toLowerCase();
    if (normalized.includes('intake')) return 'Submit initial documents';
    if (normalized.includes('discovery')) return 'Review produced evidence';
    if (normalized.includes('hearing') || normalized.includes('trial')) {
      return 'Prepare hearing bundle';
    }
    if (normalized.includes('settle') || normalized.includes('close')) return 'Await final closure notice';
    return 'Await next update from your legal team';
  }

  private async resolveClientAndMatter(
    tenantId: string,
    clientId?: string,
    matterId?: string,
  ) {
    if (!clientId && !matterId) {
      throw new BadRequestException('Either clientId or matterId is required');
    }

    let resolvedMatterId: string | undefined;
    let resolvedClientId = clientId;

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: matterId, tenantId },
        select: { id: true, clientId: true },
      });

      if (!matter) {
        throw new NotFoundException('Matter not found');
      }

      if (resolvedClientId && matter.clientId && matter.clientId !== resolvedClientId) {
        throw new BadRequestException(
          'Provided clientId does not match the selected matter',
        );
      }

      resolvedMatterId = matter.id;
      resolvedClientId = resolvedClientId ?? matter.clientId ?? undefined;
    }

    if (!resolvedClientId) {
      throw new BadRequestException(
        'A client-linked matter or an explicit clientId is required',
      );
    }

    const client = await this.prisma.client.findFirst({
      where: { id: resolvedClientId, tenantId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return {
      clientId: client.id,
      matterId: resolvedMatterId,
    };
  }

  // ── Portal task collaboration ─────────────────────────────────────────────

  async listPortalTasks(clientId: string, tenantId: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        participants: { some: { clientId, participantType: 'CLIENT' } },
        status: { not: 'CANCELLED' },
      },
      include: {
        matter: { select: { id: true, title: true } },
        participants: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getPortalTask(clientId: string, tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId,
        participants: { some: { clientId, participantType: 'CLIENT' } },
      },
      include: {
        matter: { select: { id: true, title: true } },
        participants: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found or access denied');
    }

    return task;
  }

  async updatePortalTask(
    clientId: string,
    tenantId: string,
    taskId: string,
    dto: { status?: string; notes?: string },
  ) {
    await this.getPortalTask(clientId, tenantId, taskId);

    const allowed: Record<string, string> = {
      TODO: 'TODO',
      IN_PROGRESS: 'IN_PROGRESS',
      DONE: 'DONE',
    };
    const data: Record<string, unknown> = {};
    if (dto.status && allowed[dto.status]) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.task.update({
      where: { id: taskId },
      data,
    });
  }

  async addPortalTaskComment(
    clientId: string,
    tenantId: string,
    taskId: string,
    body: string,
  ) {
    await this.getPortalTask(clientId, tenantId, taskId);

    return this.prisma.taskComment.create({
      data: {
        tenantId,
        taskId,
        body,
        authorClientId: clientId,
      },
    });
  }

  /**
   * Share a generated document link with the client via a portal message.
   * Creates a portal message with a downloadable link so the client can review/sign.
   */
  async shareDocumentWithClient(
    tenantId: string,
    senderUserId: string,
    dto: {
      matterId: string;
      clientId?: string;
      documentName: string;
      documentUrl: string;
      message?: string;
    },
  ) {
    const relation = await this.resolveClientAndMatter(tenantId, dto.clientId, dto.matterId);

    const body = [
      dto.message?.trim() || `Your lawyer has shared a document for your review.`,
      ``,
      `Document: ${dto.documentName}`,
      `Download: ${dto.documentUrl}`,
      ``,
      `Please review and let your lawyer know if you have any questions.`,
    ].join('\n');

    const portalMsg = await this.prisma.portalMessage.create({
      data: {
        tenantId,
        clientId: relation.clientId,
        matterId: relation.matterId,
        subject: `Document shared: ${dto.documentName}`,
        body,
        fromFirm: true,
        sentById: senderUserId,
      },
    });

    return {
      success: true,
      messageId: portalMsg.id,
      clientId: relation.clientId,
    };
  }
}
