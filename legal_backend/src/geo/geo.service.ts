import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRY_CODES,
  getCountryConfig,
} from '@/config/countries';

export interface GeoDetectResult {
  countryCode: string;
  countryName: string;
  source: 'cf-ipcountry' | 'ipapi' | 'default';
  detectedRaw?: string;
}

@Injectable()
export class GeoService {
  constructor(private readonly configService: ConfigService) {}

  normalizeCountryCode(code?: string | null): string {
    const upper = code?.toUpperCase();
    if (upper && SUPPORTED_COUNTRY_CODES.includes(upper)) {
      return upper;
    }
    return this.configService.get<string>('DEFAULT_COUNTRY', 'US').toUpperCase();
  }

  async detectFromRequest(headers: Record<string, string | string[] | undefined>): Promise<GeoDetectResult> {
    const cfCountry = this.readHeader(headers, 'cf-ipcountry');
    if (cfCountry && cfCountry !== 'XX') {
      const normalized = this.normalizeCountryCode(cfCountry);
      const config = getCountryConfig(normalized);
      return {
        countryCode: config.code,
        countryName: config.name,
        source: 'cf-ipcountry',
        detectedRaw: cfCountry,
      };
    }

    const forwardedFor = this.readHeader(headers, 'x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim();

    if (clientIp) {
      const ipapiResult = await this.detectFromIpApi(clientIp);
      if (ipapiResult) {
        return ipapiResult;
      }
    }

    const ipapiSelf = await this.detectFromIpApi();
    if (ipapiSelf) {
      return ipapiSelf;
    }

    const fallback = this.normalizeCountryCode(null);
    const config = COUNTRY_CONFIGS[fallback] ?? COUNTRY_CONFIGS.US;
    return {
      countryCode: config.code,
      countryName: config.name,
      source: 'default',
    };
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private async detectFromIpApi(ip?: string): Promise<GeoDetectResult | null> {
    try {
      const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        country_code?: string;
        country_name?: string;
      };

      if (!data.country_code) {
        return null;
      }

      const normalized = this.normalizeCountryCode(data.country_code);
      const config = getCountryConfig(normalized);

      return {
        countryCode: config.code,
        countryName: config.name,
        source: 'ipapi',
        detectedRaw: data.country_code,
      };
    } catch {
      return null;
    }
  }
}
