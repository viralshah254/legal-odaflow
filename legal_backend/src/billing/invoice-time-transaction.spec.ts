import { Prisma } from '@prisma/client';
import { InvoicesService } from './invoices.service';

describe('approved time invoicing', () => {
  function setup(rate: Prisma.Decimal | null = new Prisma.Decimal('125.50')) {
    const tx = {
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([{ id: 'time-1', minutes: 30, rate }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      invoice: { create: jest.fn(({ data }) => Promise.resolve({ id: 'invoice-1', ...data })) },
    };
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue({ id: 'matter-1', clientId: 'client-1' }) },
      timeEntry: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const svc = Object.create(InvoicesService.prototype) as InvoicesService;
    Object.assign(svc, { prisma, realtime: { publishToTenant: jest.fn() }, buildPaymentLink: () => '/payment' });
    return { svc, tx, prisma };
  }

  it('claims entries and creates a traceable invoice within serializable isolation', async () => {
    const { svc, tx, prisma } = setup();
    await svc.createFromApprovedTime('tenant-1', { matterId: 'matter-1', currency: 'USD' });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      amount: new Prisma.Decimal('62.75'), metadata: { timeEntryIds: ['time-1'] },
    }) });
    expect(tx.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', status: 'APPROVED', id: { in: ['time-1'] } },
      data: { status: 'INVOICED' },
    });
  });

  it('does not silently invoice missing rates as zero', async () => {
    const { svc, tx } = setup(null);
    await expect(svc.createFromApprovedTime('tenant-1', { matterId: 'matter-1' })).rejects.toThrow('confirmed');
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.timeEntry.updateMany).not.toHaveBeenCalled();
  });
});
