import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CourtListenerSearchParams {
  query: string;
  jurisdiction?: string;
  limit?: number;
}

export interface CourtListenerResult {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  sourceUrl: string | null;
  summary: string | null;
}

export interface CourtListenerCitationHit {
  citation: string;
  normalizedCitations: string[];
  status: number;
  clusterId?: string;
  caseName?: string;
  sourceUrl?: string;
}

@Injectable()
export class CourtListenerConnector {
  private readonly logger = new Logger(CourtListenerConnector.name);
  private readonly baseUrl = 'https://www.courtlistener.com/api/rest/v4';

  constructor(private readonly configService: ConfigService) {}

  private getToken(): string {
    return (
      this.configService.get<string>('COURTLISTENER_TOKEN', '').trim() ||
      this.configService.get<string>('COURTLISTENER_API_TOKEN', '').trim()
    );
  }

  isConfigured(): boolean {
    return this.getToken().length > 0;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Token ${this.getToken()}`,
      Accept: 'application/json',
      'User-Agent': 'Umbrella-Legal-Platform/1.0 (legal-by-odaflow)',
    };
  }

  async search(params: CourtListenerSearchParams): Promise<CourtListenerResult[]> {
    const token = this.getToken();
    if (!token) {
      return [];
    }

    const url = new URL(`${this.baseUrl}/search/`);
    url.searchParams.set('q', params.query);
    url.searchParams.set('type', 'o');
    if (params.jurisdiction) {
      url.searchParams.set('court', params.jurisdiction);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        this.logger.warn(`CourtListener search returned ${response.status}`);
        return [];
      }

      const payload = (await response.json()) as {
        results?: Array<{
          id?: number;
          caseName?: string;
          citation?: string[];
          court?: string;
          absolute_url?: string;
          snippet?: string;
        }>;
      };

      return (payload.results ?? []).slice(0, params.limit ?? 5).map((row) => ({
        id: `cl-${row.id ?? Date.now()}`,
        title: row.caseName ?? 'Untitled opinion',
        citation: row.citation?.[0] ?? null,
        court: row.court ?? null,
        sourceUrl: row.absolute_url
          ? `https://www.courtlistener.com${row.absolute_url}`
          : null,
        summary: row.snippet ?? null,
      }));
    } catch (err) {
      this.logger.error('CourtListener search failed', err);
      return [];
    }
  }

  /** POST /citation-lookup/ — validate citations in AI output (US case law). */
  async lookupCitationsInText(text: string): Promise<CourtListenerCitationHit[]> {
    const token = this.getToken();
    if (!token || !text.trim()) {
      return [];
    }

    try {
      const body = new URLSearchParams({ text: text.slice(0, 64_000) });
      const response = await fetch(`${this.baseUrl}/citation-lookup/`, {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        this.logger.warn(`CourtListener citation lookup returned ${response.status}`);
        return [];
      }

      const payload = (await response.json()) as Array<{
        citation?: string;
        normalized_citations?: string[];
        status?: number;
        clusters?: Array<{
          id?: number;
          case_name?: string;
          absolute_url?: string;
        }>;
      }>;

      return (payload ?? []).map((row) => {
        const cluster = row.clusters?.[0];
        return {
          citation: row.citation ?? row.normalized_citations?.[0] ?? '',
          normalizedCitations: row.normalized_citations ?? [],
          status: row.status ?? 0,
          clusterId: cluster?.id ? String(cluster.id) : undefined,
          caseName: cluster?.case_name,
          sourceUrl: cluster?.absolute_url
            ? `https://www.courtlistener.com${cluster.absolute_url}`
            : undefined,
        };
      });
    } catch (err) {
      this.logger.error('CourtListener citation lookup failed', err);
      return [];
    }
  }
}
