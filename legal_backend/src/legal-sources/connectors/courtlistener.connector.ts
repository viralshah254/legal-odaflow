import { Injectable } from '@nestjs/common';
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

@Injectable()
export class CourtListenerConnector {
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

  async search(params: CourtListenerSearchParams): Promise<CourtListenerResult[]> {
    const token = this.getToken();
    if (!token) {
      return [];
    }

    const url = new URL('https://www.courtlistener.com/api/rest/v4/search/');
    url.searchParams.set('q', params.query);
    url.searchParams.set('type', 'o');
    if (params.jurisdiction) {
      url.searchParams.set('court', params.jurisdiction);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
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
        id: String(row.id ?? ''),
        title: row.caseName ?? 'Untitled opinion',
        citation: row.citation?.[0] ?? null,
        court: row.court ?? null,
        sourceUrl: row.absolute_url
          ? `https://www.courtlistener.com${row.absolute_url}`
          : null,
        summary: row.snippet ?? null,
      }));
    } catch {
      return [];
    }
  }
}
