import { researchRequestSignal } from '@/common/utils/research-execution-budget';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TavilySearchParams {
  query: string;
  countryCode?: string;
  limit?: number;
}

export interface TavilyResult {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  sourceUrl: string;
  summary: string | null;
  judges: string[];
  decisionDate: Date | null;
}

interface TavilyApiResult {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
}

interface TavilyApiResponse {
  results?: TavilyApiResult[];
}

const AFRICA_COMMON_LAW_DOMAINS = [
  'ulii.org',
  'africanlii.org',
  'bailii.org',
  'kenyalaw.org',
  'eaclii.org',
  'saflii.org',
  'tanzlii.org',
  'zamlii.org',
  'scl.org.uk',
];

const LEGAL_DOMAINS: Record<string, string[]> = {
  KE: ['kenyalaw.org', 'centralbank.go.ke', 'africanlii.org', 'eaclii.org', 'icourts.go.ke', 'bailii.org', 'ulii.org'],
  UG: [
    'ulii.org',
    'africanlii.org',
    'bailii.org',
    'eaclii.org',
    'legislation.ug',
    'judiciary.go.ug',
    'scl.org.uk',
  ],
  TZ: ['tanzlii.org', 'africanlii.org', 'bailii.org', 'eaclii.org', 'ulii.org'],
  ZM: ['zamlii.org', 'africanlii.org', 'bailii.org', 'saflii.org'],
  ZW: ['zimlii.org', 'africanlii.org', 'bailii.org', 'saflii.org'],
  NG: ['nigeria-law.org', 'africanlii.org', 'bailii.org', 'saflii.org'],
  GH: ['ghalii.org', 'africanlii.org', 'bailii.org'],
  ZA: ['saflii.org', 'africanlii.org', 'bailii.org', 'justice.gov.za'],
  IN: [
    'sci.gov.in',
    'api.sci.gov.in',
    'main.sci.gov.in',
    'indiankanoon.org',
    'indiacode.nic.in',
    'labour.gov.in',
    'legislative.gov.in',
    'ncrb.gov.in',
    'mha.gov.in',
    'rbi.org.in',
    'judgments.ecourts.gov.in',
  ],
  US: ['courtlistener.com', 'justia.com', 'law.cornell.edu', 'supremecourt.gov', 'congress.gov'],
  GB: ['bailii.org', 'supremecourt.uk', 'legislation.gov.uk', 'judiciary.gov.uk', 'scl.org.uk'],
  DEFAULT: [
    ...AFRICA_COMMON_LAW_DOMAINS,
    'courtlistener.com',
    'indiankanoon.org',
    'justia.com',
    'legislation.gov.uk',
  ],
};

@Injectable()
export class TavilySearchConnector {
  private readonly logger = new Logger(TavilySearchConnector.name);
  private readonly baseUrl = 'https://api.tavily.com/search';
  private consecutiveHttpFailures = 0;
  private circuitOpenUntil = 0;

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    return (this.configService.get<string>('TAVILY_API_KEY', '') ?? '').trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  /** True when repeated HTTP failures opened the process-level circuit. */
  isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  async search(params: TavilySearchParams): Promise<TavilyResult[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];
    if (this.isCircuitOpen()) {
      this.logger.warn('Tavily circuit open — skipping live search');
      return [];
    }

    const requestedCountry = params.countryCode?.trim().toUpperCase().split('-')[0];
    const country = requestedCountry === 'UK' ? 'GB' : requestedCountry;
    const domains = country ? LEGAL_DOMAINS[country] : LEGAL_DOMAINS.DEFAULT;
    let countryName = country;
    if (country && !domains) {
      try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country; } catch { /* retain requested country */ }
    }
    // An explicit unsupported country uses scoped discovery, never another
    // jurisdiction's India/US/common-law domain defaults.
    const query = country && !domains
      ? `${params.query} — jurisdiction: ${countryName} (${country})` : params.query;

    try {
      const body = {
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        ...(domains?.length ? { include_domains: domains } : {}),
        max_results: params.limit ?? 6,
        include_answer: false,
        include_raw_content: false,
        max_tokens: 2000,
      };

      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: researchRequestSignal(12_000),
      });

      if (!res.ok) {
        this.recordHttpFailure(res.status);
        this.logger.warn(`Tavily search returned ${res.status}`);
        return [];
      }

      this.consecutiveHttpFailures = 0;
      const data: TavilyApiResponse = await res.json();
      const results = data?.results ?? [];

      return results.map((r, idx): TavilyResult => {
        const decisionDate = r.published_date ? new Date(r.published_date) : null;
        return {
          id: `tavily-${idx}-${Date.now()}`,
          title: r.title ?? 'Case',
          citation: null,
          court: this.inferCourt(r.url ?? '', r.title ?? ''),
          sourceUrl: r.url ?? '',
          summary: r.content ? r.content.slice(0, 2000) : null,
          judges: [],
          decisionDate: decisionDate && !isNaN(decisionDate.getTime()) ? decisionDate : null,
        };
      });
    } catch (err) {
      this.recordHttpFailure(0);
      this.logger.error('Tavily search failed', err);
      return [];
    }
  }

  private recordHttpFailure(httpStatus: number): void {
    this.consecutiveHttpFailures += 1;
    // Open circuit after auth failures immediately, or after 2 consecutive 400/other failures.
    const openNow =
      httpStatus === 401 ||
      httpStatus === 403 ||
      this.consecutiveHttpFailures >= 2;
    if (!openNow) return;
    const cooldownMs = Number(
      this.configService.get('TAVILY_FAILURE_COOLDOWN_MS') ?? 120_000,
    );
    this.circuitOpenUntil =
      Date.now() + Math.max(30_000, Number.isFinite(cooldownMs) ? cooldownMs : 120_000);
    this.logger.warn(
      `Tavily circuit opened for ${this.circuitOpenUntil - Date.now()}ms after HTTP ${httpStatus || 'error'} (failures=${this.consecutiveHttpFailures})`,
    );
  }

  private inferCourt(url: string, title: string): string | null {
    const u = url.toLowerCase();
    const t = title.toLowerCase();
    if (u.includes('supremecourt') || t.includes('supreme court')) return 'Supreme Court';
    if (u.includes('courtofappeal') || t.includes('court of appeal')) return 'Court of Appeal';
    if (u.includes('highcourt') || t.includes('high court')) return 'High Court';
    if (u.includes('bailii') && u.includes('uksc')) return 'UK Supreme Court';
    if (u.includes('bailii') && u.includes('ewca')) return 'England and Wales Court of Appeal';
    if (u.includes('kenyalaw') && u.includes('appeal')) return 'Court of Appeal (Kenya)';
    if (u.includes('kenyalaw')) return 'High Court of Kenya';
    if (u.includes('courtlistener')) return 'US Federal Court';
    return null;
  }
}
