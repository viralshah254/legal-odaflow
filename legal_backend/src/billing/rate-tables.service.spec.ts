import { RateTablesService } from './rate-tables.service';

describe('RateTablesService', () => {
  const prisma = {
    rateTable: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tenantUser: {
      findFirst: jest.fn(),
    },
  };

  const service = new RateTablesService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('resolves rate for role from default table', async () => {
    prisma.rateTable.findFirst.mockResolvedValue({
      id: 'rt1',
      currency: 'USD',
      rates: { ASSOCIATE: 250, default: 200 },
    });

    const result = await service.resolveRateForRole('tenant1', 'ASSOCIATE');
    expect(result).toEqual({ rate: 250, currency: 'USD' });
  });

  it('returns null when no default table', async () => {
    prisma.rateTable.findFirst.mockResolvedValue(null);
    const result = await service.resolveRateForRole('tenant1', 'ASSOCIATE');
    expect(result).toBeNull();
  });

  it('resolves rate for user via tenant role', async () => {
    prisma.tenantUser.findFirst.mockResolvedValue({ role: 'PARTNER' });
    prisma.rateTable.findFirst.mockResolvedValue({
      id: 'rt1',
      currency: 'USD',
      rates: { PARTNER: 450, default: 200 },
    });

    const result = await service.resolveRateForUserId('tenant1', 'user1');
    expect(result).toEqual({ rate: 450, currency: 'USD' });
  });
});
