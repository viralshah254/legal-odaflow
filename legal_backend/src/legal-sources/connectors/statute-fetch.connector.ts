import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheEntry {
  text: string;
  expiresAt: number;
}

const ALLOWED_HOSTS = [
  'indiacode.nic.in',
  'prsindia.org',
  'legislative.gov.in',
  'lddashboard.legislative.gov.in',
  'ncrb.gov.in',
  'mha.gov.in',
  'sci.gov.in',
  'main.sci.gov.in',
  'kenyalaw.org',
  'legislation.gov.uk',
  'congress.gov',
  'law.cornell.edu',
];

/** Max characters of fetched text returned to the ReAct agent per call. */
const MAX_CHARS = 4000;

/**
 * Fetches the text content of a statute URL from approved legal sources.
 * Uses an in-process Map cache keyed by URL with TTL from
 * LEGAL_CONNECTOR_CACHE_TTL_SECONDS (default 86400s).
 */
@Injectable()
export class StatuteFetchConnector {
  private readonly logger = new Logger(StatuteFetchConnector.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly configService: ConfigService) {}

  private get ttlMs(): number {
    const seconds = Number(
      this.configService.get<string>('LEGAL_CONNECTOR_CACHE_TTL_SECONDS', '86400'),
    );
    return seconds * 1000;
  }

  private isAllowed(url: string): boolean {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  async fetchText(sourceUrl: string): Promise<string> {
    if (!this.isAllowed(sourceUrl)) {
      return `URL not permitted. Allowed sources: ${ALLOWED_HOSTS.join(', ')}`;
    }

    const cached = this.cache.get(sourceUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.text;
    }

    try {
      const res = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'LegalResearchBot/1.0 (legal research assistant)' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        this.logger.warn(`statute-fetch: ${res.status} for ${sourceUrl}`);
        return `Failed to fetch (HTTP ${res.status}). Try a different source URL.`;
      }

      const contentType = res.headers.get('content-type') ?? '';
      let text: string;

      if (contentType.includes('application/pdf')) {
        // PDFs can't be parsed as text here — direct the agent to use search_statute instead.
        return 'PDF detected — use search_statute or search_corpus to retrieve section text from the ingested corpus instead.';
      }

      const raw = await res.text();
      // Strip HTML tags and collapse whitespace to get readable text
      text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, MAX_CHARS);

      this.cache.set(sourceUrl, { text, expiresAt: Date.now() + this.ttlMs });

      // Evict entries that have expired to prevent unbounded growth
      if (this.cache.size > 200) {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.expiresAt <= now) this.cache.delete(key);
        }
      }

      return text;
    } catch (err) {
      this.logger.error(`statute-fetch failed for ${sourceUrl}`, err);
      return 'Fetch failed (network error or timeout). Try search_statute or search_web instead.';
    }
  }
}
