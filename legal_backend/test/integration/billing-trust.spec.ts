import { BadRequestException } from '@nestjs/common';
import { InvoicesService, TrustService } from '@/billing/invoices.service';

describe('Billing trust integration', () => {
  it('blocks trust disbursement that would make balance negative', async () => {
    const prisma = {
      trustLedgerEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'entry_1',
          accountId: 'acct_1',
          status: 'PENDING',
          amount: 150,
          description: 'Disbursement pending',
          account: {
            id: 'acct_1',
            tenantId: 'tenant_1',
            balance: 100,
          },
        }),
      },
      $transaction: jest.fn(),
    } as any;

    const service = new TrustService(prisma);

    await expect(
      service.approveEntry('tenant_1', 'entry_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks invoice creation when unapproved billable time exists', async () => {
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client_1' }) },
      matter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'matter_1', clientId: 'client_1' }),
      },
      timeEntry: {
        count: jest.fn().mockResolvedValue(2),
      },
      invoice: { create: jest.fn() },
    } as any;

    const service = new InvoicesService(prisma, {} as any, {} as any);

    await expect(
      service.create('tenant_1', {
        clientId: 'client_1',
        matterId: 'matter_1',
        invoiceNumber: 'INV-001',
        amount: 500,
        currency: 'USD',
      }),
    ).rejects.toThrow('Cannot create invoice: matter has 2 unapproved billable time entries');

    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('blocks createFromApprovedTime when unapproved billable time exists', async () => {
    const prisma = {
      matter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'matter_1', clientId: 'client_1' }),
      },
      timeEntry: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(),
      },
      invoice: { create: jest.fn() },
    } as any;

    const service = new InvoicesService(prisma, {} as any, {} as any);

    await expect(
      service.createFromApprovedTime('tenant_1', { matterId: 'matter_1' }),
    ).rejects.toThrow('Cannot create invoice: matter has 1 unapproved billable time entries');
  });
});
