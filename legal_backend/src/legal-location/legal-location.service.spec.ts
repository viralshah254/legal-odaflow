import { ConfigService } from '@nestjs/config';
import { USER_TYPES } from '@/auth/constants';
import { PrismaService } from '@/prisma/prisma.service';
import { LegalLocationService } from './legal-location.service';

describe('LegalLocationService', () => {
  const prisma = {
    matter: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const configService = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'DEFAULT_COUNTRY' ? 'IN' : fallback,
    ),
  } as unknown as ConfigService;

  let service: LegalLocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LegalLocationService(prisma, configService);
  });

  it('prefers explicit request override over profile and matter', async () => {
    (prisma.matter.findFirst as jest.Mock).mockResolvedValue({
      countryCode: 'US',
      jurisdiction: 'California',
    });

    const result = await service.resolve({
      userId: 'user_1',
      matterId: 'matter_1',
      requestCountryCode: 'IN',
      requestJurisdiction: 'Maharashtra',
    });

    expect(result).toMatchObject({
      countryCode: 'IN',
      jurisdiction: 'Maharashtra',
      source: 'request',
      assumed: false,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('uses matter location when request override is absent', async () => {
    (prisma.matter.findFirst as jest.Mock).mockResolvedValue({
      countryCode: 'IN',
      jurisdiction: 'Delhi',
    });

    const result = await service.resolve({
      userId: 'user_1',
      tenantId: 'tenant_1',
      matterId: 'matter_1',
    });

    expect(result).toMatchObject({
      countryCode: 'IN',
      jurisdiction: 'Delhi',
      source: 'matter',
      assumed: false,
    });
  });

  it('uses tenant country for lawyers when no request or matter override exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      userType: USER_TYPES.LAWYER,
      countryCode: 'SG',
      jurisdiction: 'Maharashtra',
      consumerProfile: null,
      tenantUsers: [
        {
          tenant: {
            primaryCountry: 'IN',
          },
        },
      ],
    });

    const result = await service.resolve({
      userId: 'user_1',
      tenantId: 'tenant_1',
    });

    expect(result).toMatchObject({
      countryCode: 'IN',
      jurisdiction: 'Maharashtra',
      source: 'tenant',
      assumed: false,
    });
  });

  it('uses consumer profile location for consumers', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      userType: USER_TYPES.CONSUMER,
      countryCode: null,
      jurisdiction: null,
      consumerProfile: {
        countryCode: 'IN',
        stateOrCounty: 'Karnataka',
      },
      tenantUsers: [],
    });

    const result = await service.resolve({ userId: 'user_1' });

    expect(result).toMatchObject({
      countryCode: 'IN',
      jurisdiction: 'Karnataka',
      source: 'profile',
      assumed: false,
    });
  });

  it('uses geo hint for guests only', async () => {
    const result = await service.resolve({
      geoHintCountryCode: 'SG',
      geoHintJurisdiction: 'Singapore',
    });

    expect(result).toMatchObject({
      countryCode: 'SG',
      jurisdiction: 'Singapore',
      source: 'geo',
      assumed: true,
    });
  });

  it('ignores geo hint for authenticated users without stronger sources', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      userType: USER_TYPES.LAWYER,
      countryCode: null,
      jurisdiction: null,
      consumerProfile: null,
      tenantUsers: [
        {
          tenant: {
            primaryCountry: 'IN',
          },
        },
      ],
    });

    const result = await service.resolve({
      userId: 'user_1',
      tenantId: 'tenant_1',
      geoHintCountryCode: 'SG',
    });

    expect(result.countryCode).toBe('IN');
    expect(result.source).toBe('tenant');
  });

  it('falls back to platform default when nothing else is available', async () => {
    const result = await service.resolve({});

    expect(result).toMatchObject({
      countryCode: 'IN',
      source: 'default',
      assumed: true,
    });
  });

  it('resolves profile snapshots synchronously for /users/me formatting', () => {
    const result = service.resolveFromSnapshot({
      userType: USER_TYPES.LAWYER,
      countryCode: 'SG',
      jurisdiction: 'Delhi',
      tenant: { primaryCountry: 'IN' },
    });

    expect(result).toMatchObject({
      countryCode: 'IN',
      jurisdiction: 'Delhi',
      source: 'tenant',
      assumed: false,
    });
  });
});
