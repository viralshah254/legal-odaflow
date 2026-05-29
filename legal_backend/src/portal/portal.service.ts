import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { getCountryConfig } from '@/config/countries';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import { CreatePortalDocumentRequestDto } from './dto/create-document-request.dto';
import { CreatePortalMessageDto } from './dto/create-portal-message.dto';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { UploadPortalRequestDocumentDto } from './dto/upload-request-document.dto';
import { MatterOutcomeService } from '@/matter-outcome/matter-outcome.service';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly paymentsService: PaymentsService,
    private readonly matterOutcomeService: MatterOutcomeService,
  ) {}

  getOutcomeSummary(clientId: string, tenantId: string, matterId: string) {
    return this.matterOutcomeService.getPortalOutcomeSummary(
      tenantId,
      matterId,
      clientId,
    );
  }

  async login(dto: PortalLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const providedName = dto.fullName.trim().toLowerCase();
    const client = await this.prisma.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (!client) {
      throw new UnauthorizedException('No client portal account found for this email');
    }
    const canonicalClientName = client.name.trim().toLowerCase();
    if (!canonicalClientName || canonicalClientName !== providedName) {
      throw new UnauthorizedException('Portal sign-in details did not match');
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
        select: {
          id: true,
          title: true,
          status: true,
          stage: true,
          practiceArea: true,
          updatedAt: true,
        },
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
      matters: matters.map((m) => ({
        id: m.id,
        title: m.title,
        ref: m.id.slice(-8).toUpperCase(),
        status: m.status,
        stage: m.stage ?? 'Active',
        progressPercent: this.estimateMatterProgress(m.stage),
        nextStep: this.inferNextStep(m.stage),
        practiceArea: m.practiceArea,
        updatedAt: m.updatedAt.toISOString(),
      })),
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

  async getPublicInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const client = invoice.clientId
      ? await this.prisma.client.findUnique({ where: { id: invoice.clientId } })
      : null;

    return this.mapInvoice(invoice, client?.name ?? 'Client');
  }

  async payInvoice(invoiceId: string, dto: PayInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

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
          paymentProvider: country.defaultPaymentProvider,
        },
      },
    );

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
        checkoutUrl: intent.checkoutUrl,
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
      createdAt: Date;
    },
    clientName: string,
  ) {
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
      paymentLink: `/pay/${invoice.id}`,
    };
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
}
