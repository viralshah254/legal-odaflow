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
  /** Raw region name from the geo provider (e.g. "Maharashtra", "California"). */
  region?: string;
  source: 'cf-ipcountry' | 'ipapi' | 'default';
  detectedRaw?: string;
}

/** Raw client geo for web issue-checker — any ISO country, not tier-1-only. */
export interface ClientGeoDetectResult {
  countryCode: string;
  regionCode?: string;
  regionName?: string;
  source: 'cf-ipcountry' | 'ipapi' | 'default' | 'none';
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

  /** Web client geo — preserves any ISO country code + region from IP. */
  async detectClientFromRequest(
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ClientGeoDetectResult> {
    const cfCountry = this.readHeader(headers, 'cf-ipcountry')?.trim().toUpperCase();
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      return { countryCode: cfCountry, source: 'cf-ipcountry' };
    }

    const forwardedFor = this.readHeader(headers, 'x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim();
    const lookupIp = clientIp && !this.isPrivateOrLocalIp(clientIp) ? clientIp : undefined;

    // Public client IP → lookup by address; private/missing → egress (localhost).
    const ipapiResult = lookupIp
      ? await this.detectRawFromIpApi(lookupIp)
      : await this.detectRawFromEgress();
    if (ipapiResult) {
      return ipapiResult;
    }

    // Do not invent DEFAULT_COUNTRY / India — callers treat XX as "unknown location".
    return { countryCode: 'XX', source: 'none' };
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
    const lookupIp = clientIp && !this.isPrivateOrLocalIp(clientIp) ? clientIp : undefined;

    if (lookupIp) {
      const ipapiResult = await this.detectFromIpApi(lookupIp);
      if (ipapiResult) {
        return ipapiResult;
      }
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

  private isPrivateOrLocalIp(ip: string): boolean {
    const value = ip.trim().toLowerCase();
    if (!value || value === '::1' || value.startsWith('127.')) return true;
    if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('169.254.')) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
    return false;
  }

  private async detectRawFromIpApi(ip?: string): Promise<ClientGeoDetectResult | null> {
    const lookupIp = ip && !this.isPrivateOrLocalIp(ip) ? ip : undefined;
    if (!lookupIp) return null;

    for (const detect of [
      () => this.detectRawFromIpWhoIs(lookupIp),
      () => this.detectRawFromIpApiCom(lookupIp),
      () => this.detectRawFromIpApiCo(lookupIp),
    ]) {
      const result = await detect();
      if (result) return result;
    }
    return null;
  }

  /** Geolocate this host's public egress IP (no client address). */
  private async detectRawFromEgress(): Promise<ClientGeoDetectResult | null> {
    for (const detect of [
      () => this.detectEgressFromIpApiCo(),
      () => this.detectEgressFromIpWhoIs(),
      () => this.detectEgressFromIpApiCom(),
    ]) {
      const result = await detect();
      if (result) return result;
    }
    return null;
  }

  private async detectEgressFromIpApiCo(): Promise<ClientGeoDetectResult | null> {
    try {
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        country_code?: string;
        region_code?: string;
        region?: string;
        error?: boolean;
      };
      if (data.error || !data.country_code) return null;

      const countryCode = data.country_code.trim().toUpperCase();
      if (countryCode.length !== 2 || countryCode === 'XX') return null;

      return {
        countryCode,
        regionCode: data.region_code?.trim().toUpperCase() || undefined,
        regionName: data.region?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectEgressFromIpWhoIs(): Promise<ClientGeoDetectResult | null> {
    try {
      const response = await fetch('https://ipwho.is/', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        success?: boolean;
        country_code?: string;
        region_code?: string;
        region?: string;
      };
      if (!data.success || !data.country_code) return null;

      const countryCode = data.country_code.trim().toUpperCase();
      if (countryCode.length !== 2 || countryCode === 'XX') return null;

      return {
        countryCode,
        regionCode: data.region_code?.trim().toUpperCase() || undefined,
        regionName: data.region?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectEgressFromIpApiCom(): Promise<ClientGeoDetectResult | null> {
    try {
      const response = await fetch(
        'http://ip-api.com/json/?fields=status,countryCode,regionName,region',
      );
      if (!response.ok) return null;

      const data = (await response.json()) as {
        status?: string;
        countryCode?: string;
        region?: string;
        regionName?: string;
      };
      if (data.status !== 'success' || !data.countryCode) return null;

      const countryCode = data.countryCode.trim().toUpperCase();
      if (countryCode.length !== 2) return null;

      return {
        countryCode,
        regionCode: data.region?.trim().toUpperCase() || undefined,
        regionName: data.regionName?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectRawFromIpApiCo(ip: string): Promise<ClientGeoDetectResult | null> {
    try {
      const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        country_code?: string;
        region_code?: string;
        region?: string;
        error?: boolean;
      };
      if (data.error || !data.country_code) return null;

      const countryCode = data.country_code.trim().toUpperCase();
      if (countryCode.length !== 2 || countryCode === 'XX') return null;

      return {
        countryCode,
        regionCode: data.region_code?.trim().toUpperCase() || undefined,
        regionName: data.region?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectRawFromIpWhoIs(ip: string): Promise<ClientGeoDetectResult | null> {
    try {
      const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        success?: boolean;
        country_code?: string;
        region_code?: string;
        region?: string;
      };
      if (!data.success || !data.country_code) return null;

      const countryCode = data.country_code.trim().toUpperCase();
      if (countryCode.length !== 2 || countryCode === 'XX') return null;

      return {
        countryCode,
        regionCode: data.region_code?.trim().toUpperCase() || undefined,
        regionName: data.region?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectRawFromIpApiCom(ip: string): Promise<ClientGeoDetectResult | null> {
    try {
      const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,region`;
      const response = await fetch(url);
      if (!response.ok) return null;

      const data = (await response.json()) as {
        status?: string;
        countryCode?: string;
        region?: string;
        regionName?: string;
      };
      if (data.status !== 'success' || !data.countryCode) return null;

      const countryCode = data.countryCode.trim().toUpperCase();
      if (countryCode.length !== 2) return null;

      return {
        countryCode,
        regionCode: data.region?.trim().toUpperCase() || undefined,
        regionName: data.regionName?.trim() || undefined,
        source: 'ipapi',
      };
    } catch {
      return null;
    }
  }

  private async detectFromIpApi(ip: string): Promise<GeoDetectResult | null> {
    try {
      const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
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
        region?: string;
      };

      if (!data.country_code) {
        return null;
      }

      const normalized = this.normalizeCountryCode(data.country_code);
      const config = getCountryConfig(normalized);

      return {
        countryCode: config.code,
        countryName: config.name,
        region: data.region || undefined,
        source: 'ipapi',
        detectedRaw: data.country_code,
      };
    } catch {
      return null;
    }
  }
}
