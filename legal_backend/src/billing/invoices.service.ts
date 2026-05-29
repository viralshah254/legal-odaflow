import {
  BadRequestException,
  Inject,
  forwardRef,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AutomationEngineService } from '@/automations/automation-engine.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  CreateTrustAccountDto,
  CreateTrustEntryDto,
} from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AutomationEngineService))
    private readonly automationEngine: AutomationEngineService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async create(tenantId: string, dto: CreateInvoiceDto) {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId },
      });

      if (!client) {
        throw new NotFoundException('Client not found for tenant');
      }
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        invoiceNumber: dto.invoiceNumber,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency.toUpperCase(),
        dueDate: dto.dueDate,
        status: 'DRAFT',
      },
    });

    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.INVOICE_UPDATED, {
      entityId: invoice.id,
      action: 'created',
    });

    return invoice;
  }

  async findAll(tenantId: string, status?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((invoice) => ({
      ...invoice,
      paymentLink: `/pay/${invoice.id}`,
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
      paymentLink: `/pay/${invoice.id}`,
    };
  }

  async markSent(tenantId: string, invoiceId: string) {
    const existing = await this.findOne(tenantId, invoiceId);
    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT' },
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
        status: 'SENT',
        dueDate: { lt: now },
      },
    });

    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
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
