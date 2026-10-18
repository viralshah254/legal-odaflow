import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';

describe('GeoService.detectClientFromRequest', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'DEFAULT_COUNTRY') return 'IN';
      return fallback;
    }),
  } as unknown as ConfigService;

  const service = new GeoService(configService);

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses CF-IPCountry when present', async () => {
    const result = await service.detectClientFromRequest({
      'cf-ipcountry': 'KE',
    });
    expect(result).toEqual({ countryCode: 'KE', source: 'cf-ipcountry' });
  });

  it('uses egress lookup for private/localhost client IPs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        country_code: 'KE',
        region_code: '30',
        region: 'Nairobi City',
      }),
    }) as unknown as typeof fetch;

    const result = await service.detectClientFromRequest({
      'x-forwarded-for': '127.0.0.1',
    });

    expect(result.countryCode).toBe('KE');
    expect(result.source).toBe('ipapi');
    expect(result.regionName).toBe('Nairobi City');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ipapi.co/json/',
      expect.any(Object),
    );
  });

  it('returns XX/none when providers fail — never invents India', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    const result = await service.detectClientFromRequest({
      'x-forwarded-for': '127.0.0.1',
    });

    expect(result).toEqual({ countryCode: 'XX', source: 'none' });
    expect(result.countryCode).not.toBe('IN');
  });

  it('looks up a public client IP by address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        country_code: 'GB',
        region_code: 'ENG',
        region: 'England',
      }),
    }) as unknown as typeof fetch;

    const result = await service.detectClientFromRequest({
      'x-forwarded-for': '8.8.8.8',
    });

    expect(result.countryCode).toBe('GB');
    expect(result.source).toBe('ipapi');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('8.8.8.8'),
      expect.any(Object),
    );
  });
});
