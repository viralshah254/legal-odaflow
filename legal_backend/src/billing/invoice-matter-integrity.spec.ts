import { InvoicesService } from './invoices.service';

describe('InvoicesService matter integrity', () => {
  function buildService() {
    const prisma = {
      matter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'matter-1',
          tenantId: 'tenant-1',
          clientId: 'client-1',
        }),
      },
      client: { findFirst: jest.fn() },
      timeEntry: { count: jest.fn().mockResolvedValue(0) },
      invoice: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'invoice-1', ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = Object.create(InvoicesService.prototype) as InvoicesService;
    Object.assign(service, {
      prisma,
      realtime: { publishToTenant: jest.fn() },
    });
    return { service, prisma };
  }

  it('stores matterId relationally and derives its client', async () => {
    const { service, prisma } = buildService();

    await service.create('tenant-1', {
      matterId: 'matter-1',
      invoiceNumber: 'INV-001',
      amount: 100,
      currency: 'usd',
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matterId: 'matter-1',
        clientId: 'client-1',
      }),
    });
  });

  it('applies matter and client filters server-side', async () => {
    const { service, prisma } = buildService();

    await service.findAll('tenant-1', {
      status: 'DRAFT',
      matterId: 'matter-1',
      clientId: 'client-1',
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: 'DRAFT',
          matterId: 'matter-1',
          clientId: 'client-1',
        },
      }),
    );
  });
});
