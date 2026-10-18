import {
  BadRequestException,
  Inject,
  forwardRef,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import {
  buildPortalPaymentPath,
  signPortalPaymentToken,
} from '@/portal/portal-payment.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoiceFromApprovedTimeDto } from './dto/create-invoice-from-approved-time.dto';
import {
  CreateTrustAccountDto,
  CreateTrustEntryDto,
} from './dto/create-invoice.dto';
import { INVOICE_STATUSES } from './billing-lifecycle.constants';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    private readonly realtime: RealtimePublisherService,
    private readonly jwtService: JwtService,
  ) {}

  async create(tenantId: string, dto: CreateInvoiceDto) {
    const matter = dto.matterId
      ? await this.ensureMatter(tenantId, dto.matterId)
      : null;
    if (matter && dto.clientId !== undefined && dto.clientId !== matter.clientId) {
      throw new BadRequestException('Invoice client must match the selected matter');
    }
    const clientId = matter ? matter.clientId : dto.clientId;

    if (!matter && clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
      });

      if (!client) {
        throw new NotFoundException('Client not found for tenant');
      }
    }

    if (dto.matterId) {
      await this.ensureNoUnapprovedBillableTime(tenantId, dto.matterId);
    }

    const billingModel = dto.billingModel ?? 'HOURLY';
    const metadata = this.buildInvoiceMetadata(dto, billingModel);
    const amount = this.resolveInvoiceAmount(dto, billingModel);

    const data: Prisma.InvoiceUncheckedCreateInput = {
      tenantId,
      clientId,
      matterId: dto.matterId,
      invoiceNumber: dto.invoiceNumber,
      amount: new Prisma.Decimal(amount),
      currency: dto.currency.toUpperCase(),
      billingModel,
      dueDate: dto.dueDate,
      status: INVOICE_STATUSES.DRAFT,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    };

    const invoice = await this.prisma.invoice.create({ data });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.INVOICE_UPDATED, {
      entityId: invoice.id,
      action: 'created',
    });

    return invoice;
  }

  async createFromApprovedTime(tenantId: string, dto: CreateInvoiceFromApprovedTimeDto) {
    const matter = await this.ensureMatter(tenantId, dto.matterId);
    if (dto.clientId !== undefined && dto.clientId !== matter.clientId) {
      throw new BadRequestException('Invoice client must match the selected matter');
    }
    await this.ensureNoUnapprovedBillableTime(tenantId, dto.matterId);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        matterId: dto.matterId,
        billable: true,
        status: 'APPROVED',
      },
    });

    if (entries.length === 0) {
      throw new BadRequestException('No approved billable time entries found for this matter');
    }

    const amount = entries.reduce((sum, entry) => {
      const rate = entry.rate ? Number(entry.rate.toString()) : 0;
      return sum + (entry.minutes / 60) * rate;
    }, 0);

    const clientId = dto.clientId ?? matter.clientId ?? undefined;
    const currency = dto.currency ?? 'USD';
    const invoiceNumber =
      dto.invoiceNumber ?? `INV-TIME-${Date.now().toString(36).toUpperCase()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        clientId,
        matterId: dto.matterId,
        invoiceNumber,
        amount: new Prisma.Decimal(Math.round(amount * 100) / 100),
        currency: currency.toUpperCase(),
        dueDate: dto.dueDate,
        status: INVOICE_STATUSES.DRAFT,
      },
    });

    await this.prisma.timeEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) } },
      data: { status: 'INVOICED' },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.INVOICE_UPDATED, {
      entityId: invoice.id,
      action: 'created_from_time',
      data: {
        matterId: dto.matterId,
        timeEntryCount: entries.length,
      },
    });

    return {
      ...invoice,
      paymentLink: this.buildPaymentLink(invoice),
      timeEntryIds: entries.map((entry) => entry.id),
      timeEntryCount: entries.length,
    };
  }

  async findAll(
    tenantId: string,
    filters: { status?: string; matterId?: string; clientId?: string } = {},
  ) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: filters.status || undefined,
        matterId: filters.matterId || undefined,
        clientId: filters.clientId || undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((invoice) => ({
      ...invoice,
      paymentLink: this.buildPaymentLink(invoice),
    }));
  }

  async findOne(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      ...invoice,
      paymentLink: this.buildPaymentLink(invoice),
    };
  }

  async markSent(tenantId: string, invoiceId: string) {
    const existing = await this.findOne(tenantId, invoiceId);
    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUSES.SENT },
    });

    if (existing.dueDate && existing.dueDate < new Date()) {
      await this.automationEngine.dispatch(tenantId, 'invoice.overdue', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        dueDate: existing.dueDate.toISOString(),
      });
    }

    return invoice;
  }

  async markOverdueAndDispatch() {
    const now = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: INVOICE_STATUSES.SENT,
        dueDate: { lt: now },
      },
    });

    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: INVOICE_STATUSES.OVERDUE },
      });

      await this.automationEngine.dispatch(invoice.tenantId, 'invoice.overdue', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        dueDate: invoice.dueDate?.toISOString(),
      });
    }

    return overdueInvoices.length;
  }

  private async ensureMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found for tenant');
    }

    return matter;
  }

  private async ensureNoUnapprovedBillableTime(tenantId: string, matterId: string) {
    const unapprovedCount = await this.prisma.timeEntry.count({
      where: {
        tenantId,
        matterId,
        billable: true,
        status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
      },
    });

    if (unapprovedCount > 0) {
      throw new BadRequestException(
        `Cannot create invoice: matter has ${unapprovedCount} unapproved billable time entries`,
      );
    }
  }

  private buildPaymentLink(invoice: { id: string; tenantId: string }): string {
    const token = signPortalPaymentToken(
      this.jwtService,
      invoice.id,
      invoice.tenantId,
    );
    return buildPortalPaymentPath(invoice.id, token);
  }

  private buildInvoiceMetadata(
    dto: CreateInvoiceDto,
    billingModel: string,
  ): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};

    // Matter is stored relationally; metadata remains for non-relational invoice details.
    if (dto.description) {
      metadata.description = dto.description;
    }

    if (billingModel === 'MILESTONE' && dto.lineItems?.length) {
      metadata.lineItems = dto.lineItems.map((item) => ({
        description: item.description,
        amount: item.amount,
        ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      }));
    }

    if (billingModel === 'CONTINGENCY') {
      if (dto.contingencyPercent !== undefined) {
        metadata.contingencyPercent = dto.contingencyPercent;
      }
      if (dto.contingencyTrigger) {
        metadata.contingencyTrigger = dto.contingencyTrigger;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private resolveInvoiceAmount(dto: CreateInvoiceDto, billingModel: string): number {
    if (billingModel === 'MILESTONE' && dto.lineItems?.length) {
      const total = dto.lineItems.reduce((sum, item) => sum + item.amount, 0);
      return Math.round(total * 100) / 100;
    }

    return dto.amount;
  }
}

@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(tenantId: string, dto: CreateTrustAccountDto) {
    return this.prisma.trustAccount.create({
      data: {
        tenantId,
        name: dto.name,
        currency: dto.currency.toUpperCase(),
        balance: new Prisma.Decimal(0),
      },
    });
  }

  async listAccounts(tenantId: string) {
    return this.prisma.trustAccount.findMany({
      where: { tenantId },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.trustAccount.findFirst({
      where: { id: accountId, tenantId },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Trust account not found');
    }

    return account;
  }

  async addEntry(tenantId: string, accountId: string, dto: CreateTrustEntryDto) {
    const account = await this.getAccount(tenantId, accountId);
    const amount = new Prisma.Decimal(dto.amount);
    const currentBalance = new Prisma.Decimal(account.balance.toString());
    if (dto.matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: dto.matterId, tenantId },
      });
      if (!matter) {
        throw new NotFoundException('Matter not found for tenant');
      }
    }

    let newBalance = currentBalance;
    const type = dto.type.toUpperCase();
    const requiresApproval = type === 'DISBURSEMENT' || type === 'TRANSFER_OUT';
    const initialStatus = requiresApproval ? 'PENDING' : 'COMPLETED';

    if (type === 'DEPOSIT' || type === 'TRANSFER_IN') {
      newBalance = currentBalance.add(amount);
    } else if (type === 'DISBURSEMENT' || type === 'TRANSFER_OUT') {
      newBalance = currentBalance.sub(amount);
    } else {
      throw new BadRequestException(`Unsupported trust entry type: ${dto.type}`);
    }

    if (!requiresApproval && newBalance.lessThan(0)) {
      throw new BadRequestException('Trust account balance cannot go negative');
    }

    const entry = await this.prisma.trustLedgerEntry.create({
      data: {
        accountId,
        matterId: dto.matterId,
        type,
        amount,
        description: dto.description,
        status: initialStatus,
      },
    });

    if (!requiresApproval) {
      await this.prisma.trustAccount.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });
    }

    return {
      entry,
      balance: !requiresApproval ? newBalance : currentBalance,
    };
  }

  async approveEntry(tenantId: string, entryId: string, note?: string) {
    const entry = await this.prisma.trustLedgerEntry.findFirst({
      where: {
        id: entryId,
        account: { tenantId },
      },
      include: { account: true },
    });
    if (!entry) {
      throw new NotFoundException('Trust entry not found');
    }
    if (entry.status !== 'PENDING') {
      throw new BadRequestException('Only pending entries can be approved');
    }

    const amount = new Prisma.Decimal(entry.amount.toString());
    const currentBalance = new Prisma.Decimal(entry.account.balance.toString());
    const newBalance = currentBalance.sub(amount);
    if (Number(newBalance.toString()) < 0) {
      throw new BadRequestException('Trust account balance cannot go negative');
    }

    const [updatedEntry] = await this.prisma.$transaction([
      this.prisma.trustLedgerEntry.update({
        where: { id: entry.id },
        data: {
          status: 'COMPLETED',
          description: note?.trim()
            ? `${entry.description ?? ''}\n[Approval note] ${note.trim()}`.trim()
            : entry.description,
        },
      }),
      this.prisma.trustAccount.update({
        where: { id: entry.accountId },
        data: { balance: newBalance },
      }),
    ]);

    return { entry: updatedEntry, balance: newBalance };
  }

  async rejectEntry(tenantId: string, entryId: string, note?: string) {
    const entry = await this.prisma.trustLedgerEntry.findFirst({
      where: {
        id: entryId,
        account: { tenantId },
      },
    });
    if (!entry) {
      throw new NotFoundException('Trust entry not found');
    }
    if (entry.status !== 'PENDING') {
      throw new BadRequestException('Only pending entries can be rejected');
    }

    const updatedEntry = await this.prisma.trustLedgerEntry.update({
      where: { id: entry.id },
      data: {
        status: 'REJECTED',
        description: note?.trim()
          ? `${entry.description ?? ''}\n[Rejection note] ${note.trim()}`.trim()
          : entry.description,
      },
    });

    return { entry: updatedEntry };
  }
}
