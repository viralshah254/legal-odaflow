import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Licensed Indian case-law connector (SCC Online / Manupatra / Taxmann).
 *
 * Phase 4 integration point: wire API credentials when a license is procured.
 * Results are tagged sourceTier=licensed and stored under sourceName from config.
 */
export interface LicensedCaseLawHit {
  id: string;
  title: string;
  citation: string | null;
  neutralCitation: string | null;
  court: string | null;
  sourceUrl: string | null;
  summary: string | null;
  fullText?: string | null;
  practiceAreas: string[];
  provider: 'scc' | 'manupatra' | 'taxmann';
}

export interface LicensedSearchParams {
  query: string;
  practiceArea?: string;
  limit?: number;
  provider?: 'scc' | 'manupatra' | 'taxmann';
}

@Injectable()
export class LicensedCaseLawConnector {
  private readonly logger = new Logger(LicensedCaseLawConnector.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.resolveApiKey());
  }

  configuredProviders(): Array<'scc' | 'manupatra' | 'taxmann'> {
    const providers: Array<'scc' | 'manupatra' | 'taxmann'> = [];
    if (this.configService.get<string>('SCC_ONLINE_API_KEY', '').trim()) providers.push('scc');
    if (this.configService.get<string>('MANUPATRA_API_KEY', '').trim()) providers.push('manupatra');
    if (this.configService.get<string>('TAXMANN_API_KEY', '').trim()) providers.push('taxmann');
    return providers;
  }

  async search(params: LicensedSearchParams): Promise<LicensedCaseLawHit[]> {
    const apiKey = this.resolveApiKey(params.provider);
    if (!apiKey) {
      return [];
    }

    const provider = params.provider ?? this.configuredProviders()[0];
    if (!provider) return [];

    const baseUrl = this.resolveBaseUrl(provider);
    if (!baseUrl) {
      this.logger.warn(`Licensed case-law base URL not configured for ${provider}`);
      return [];
    }

    try {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/search`);
      url.searchParams.set('q', params.query);
      url.searchParams.set('limit', String(params.limit ?? 10));
      if (params.practiceArea) url.searchParams.set('practiceArea', params.practiceArea);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        this.logger.warn(`Licensed case-law search returned ${res.status} (${provider})`);
        return [];
      }

      const payload = (await res.json()) as { results?: Array<Record<string, unknown>> };
      return (payload.results ?? []).map((row, index) => this.toHit(row, provider, index));
    } catch (err) {
      this.logger.error(`Licensed case-law search failed (${provider})`, err);
      return [];
    }
  }

  private resolveApiKey(provider?: 'scc' | 'manupatra' | 'taxmann'): string {
    if (provider === 'scc') {
      return this.configService.get<string>('SCC_ONLINE_API_KEY', '').trim();
    }
    if (provider === 'manupatra') {
      return this.configService.get<string>('MANUPATRA_API_KEY', '').trim();
    }
    if (provider === 'taxmann') {
      return this.configService.get<string>('TAXMANN_API_KEY', '').trim();
    }
    return (
      this.configService.get<string>('SCC_ONLINE_API_KEY', '').trim() ||
      this.configService.get<string>('MANUPATRA_API_KEY', '').trim() ||
      this.configService.get<string>('TAXMANN_API_KEY', '').trim()
    );
  }

  private resolveBaseUrl(provider: 'scc' | 'manupatra' | 'taxmann'): string | null {
    const envKey =
      provider === 'scc'
        ? 'SCC_ONLINE_API_URL'
        : provider === 'manupatra'
          ? 'MANUPATRA_API_URL'
          : 'TAXMANN_API_URL';
    const url = this.configService.get<string>(envKey, '').trim();
    return url || null;
  }

  private toHit(
    row: Record<string, unknown>,
    provider: 'scc' | 'manupatra' | 'taxmann',
    index: number,
  ): LicensedCaseLawHit {
    const citation = String(row.citation ?? row.cite ?? '') || null;
    const id = String(row.id ?? `${provider}-${citation ?? index}`);
    return {
      id: id.startsWith(`${provider}-`) ? id : `${provider}-${id}`,
      title: String(row.title ?? row.caseName ?? 'Licensed judgment'),
      citation,
      neutralCitation: String(row.neutralCitation ?? row.neutral_citation ?? '') || null,
      court: String(row.court ?? '') || null,
      sourceUrl: String(row.url ?? row.sourceUrl ?? '') || null,
      summary: String(row.summary ?? row.headnote ?? '') || null,
      fullText: String(row.fullText ?? row.text ?? '') || null,
      practiceAreas: Array.isArray(row.practiceAreas)
        ? (row.practiceAreas as string[])
        : row.practiceArea
          ? [String(row.practiceArea)]
          : [],
      provider,
    };
  }
}

export function buildLicensedAuthorityId(hitId: string): string {
  return hitId.startsWith('case-in-lic-') ? hitId : `case-in-lic-${hitId}`;
}
