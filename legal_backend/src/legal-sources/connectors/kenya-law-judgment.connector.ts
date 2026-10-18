import { Injectable, Logger } from '@nestjs/common';
import { publicUrlFromFrbrUri } from '../ke-frbr.util';
import {
  isKenyaLawRetryableStatus,
  kenyaLawFetchHeaders,
  kenyaLawRateLimit,
  kenyaLawThrottleBackoff,
} from './kenya-law-rate-limit';

export interface KenyaLawSearchHit {
  id: string;
  docType: 'judgment' | 'legislation' | string;
  title: string;
  citation: string | null;
  court: string | null;
  sourceUrl: string;
  expressionFrbrUri: string;
  workFrbrUri: string;
  decisionDate: Date | null;
  judges: string[];
  caseNumber: string | null;
  summary: string | null;
}

export interface KenyaLawJudgmentBody {
  title: string;
  citation: string | null;
  court: string | null;
  sourceUrl: string;
  fullText: string;
  judges: string[];
}

const SEARCH_API = 'https://new.kenyalaw.org/search/api/documents/';
const SEARCH_HTML = 'https://new.kenyalaw.org/search/';
/** Primary Atom feed on the new Kenya Law site; legacy RSS paths kept as fallbacks. */
export const KENYA_JUDGMENTS_FEEDS = [
  'https://new.kenyalaw.org/feeds/judgments.xml',
  'https://new.kenyalaw.org/feeds/judgment.xml',
] as const;

interface SearchApiRow {
  id?: string;
  doc_type?: string;
  title?: string;
  date?: string;
  citation?: string;
  expression_frbr_uri?: string;
  work_frbr_uri?: string;
  court?: string | null;
  judges?: string[] | null;
  case_number?: string[] | null;
  highlight?: {
    'pages.body'?: string[];
    'provisions.body'?: string[];
  };
}

@Injectable()
export class KenyaLawJudgmentConnector {
  private readonly logger = new Logger(KenyaLawJudgmentConnector.name);
  private static readonly TIMEOUT_MS = 45_000;
  private static readonly MAX_SEARCH_ATTEMPTS = 3;

  /** Search Kenya Law (acts + judgments) via the public documents API, then HTML/embedded fallback. */
  async search(params: {
    query: string;
    docType?: 'judgment' | 'legislation';
    limit?: number;
    page?: number;
  }): Promise<KenyaLawSearchHit[]> {
    const limit = params.limit ?? 10;
    const page = params.page ?? 1;
    const fromApi = await this.searchViaJsonApi({
      query: params.query,
      docType: params.docType,
      limit,
      page,
    });
    if (fromApi.length > 0) return fromApi;

    this.logger.warn(
      `Kenya Law JSON search empty/failed for "${params.query.slice(0, 80)}" — trying HTML/embedded fallback`,
    );
    return this.searchViaHtmlPage({
      query: params.query,
      docType: params.docType,
      limit,
    });
  }

  async searchJudgments(query: string, limit = 10): Promise<KenyaLawSearchHit[]> {
    return this.search({ query, docType: 'judgment', limit });
  }

  async searchLegislation(query: string, limit = 10): Promise<KenyaLawSearchHit[]> {
    return this.search({ query, docType: 'legislation', limit });
  }

  /** Latest judgments from the public Atom feed (updated daily). */
  async fetchRecentFromFeed(limit = 100): Promise<KenyaLawSearchHit[]> {
    for (const feedUrl of KENYA_JUDGMENTS_FEEDS) {
      try {
        await kenyaLawRateLimit();
        const res = await fetch(feedUrl, {
          signal: AbortSignal.timeout(KenyaLawJudgmentConnector.TIMEOUT_MS),
          headers: kenyaLawFetchHeaders('application/atom+xml,application/xml,text/xml'),
        });
        if (!res.ok) {
          this.logger.warn(`Kenya Law judgments feed returned ${res.status} for ${feedUrl}`);
          continue;
        }
        return this.parseJudgmentsFeed(await res.text()).slice(0, limit);
      } catch (err) {
        this.logger.warn(`Kenya Law judgments feed fetch failed for ${feedUrl}`, err);
      }
    }
    this.logger.error('Kenya Law judgments feed fetch failed for all configured feeds');
    return [];
  }

  async fetchJudgmentBody(sourceUrl: string): Promise<KenyaLawJudgmentBody | null> {
    const html = await this.fetchHtml(sourceUrl);
    if (!html) return null;

    const title =
      decodeHtmlEntities(
        html.match(/<title>\s*([\s\S]*?)\s*-\s*Kenya Law/i)?.[1]?.trim() ?? '',
      ) || 'Kenya judgment';

    const inner =
      html.match(/id="document-content"[^>]*class="content-and-enrichments"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
        ?.[1] ??
      html.match(/class="document-content__inner"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
        ?.[1] ??
      html.match(/class="document-content"[^>]*>([\s\S]*?)<aside/i)?.[1] ??
      html.match(/class="document-content"[^>]*>([\s\S]*?)<\/div>/i)?.[1];

    if (!inner) {
      this.logger.warn(`No document body found for ${sourceUrl}`);
      return null;
    }

    const fullText = htmlToPlainText(inner);
    // Thin SPA shells: still return title/citation so callers can admit snippet-backed hits.
    if (fullText.length < 80) {
      this.logger.warn(
        `Judgment body thin for ${sourceUrl} — returning title/citation shell for snippet admit`,
      );
      return {
        title: decodeHtmlEntities(title),
        citation: extractCitationFromTitle(title),
        court: extractCourtFromTitle(title),
        sourceUrl,
        fullText: fullText || title,
        judges: [],
      };
    }

    const citation =
      html.match(/class="[^"]*document-metadata[^"]*"[\s\S]*?\[(\d{4})\]\s*([A-Z]+)\s*(\d+)/i)?.[0] ??
      title.match(/\[(\d{4})\]\s*([A-Z]+)\s*(\d+)/i)?.[0] ??
      null;

    const court =
      decodeHtmlEntities(
        html.match(/Court[^:]*:\s*<[^>]+>([^<]+)/i)?.[1]?.trim() ?? '',
      ) || null;

    const judges = [...html.matchAll(/Judge[^:]*:\s*<[^>]+>([^<]+)/gi)].map((m) =>
      decodeHtmlEntities(m[1].trim()),
    );

    return {
      title: decodeHtmlEntities(title),
      citation,
      court,
      sourceUrl,
      fullText,
      judges,
    };
  }

  parseJudgmentsFeed(xml: string): KenyaLawSearchHit[] {
    const hits: KenyaLawSearchHit[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;

    while ((match = entryRe.exec(xml)) !== null) {
      const block = match[1] ?? '';
      const title = decodeHtmlEntities(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '');
      const href = block.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim();
      const published = block.match(/<published>([^<]+)/i)?.[1]?.trim();
      if (!title || !href) continue;

      const expressionFrbrUri = frbrUriFromPublicUrl(href);
      if (!expressionFrbrUri.startsWith('akn/ke/judgment/')) continue;

      hits.push({
        id: judgmentIdFromFrbrUri(expressionFrbrUri),
        docType: 'judgment',
        title,
        citation: extractCitationFromTitle(title),
        court: extractCourtFromTitle(title),
        sourceUrl: href.startsWith('http') ? href : publicUrlFromFrbrUri(expressionFrbrUri),
        expressionFrbrUri,
        workFrbrUri: workFrbrUriFromJudgmentExpression(expressionFrbrUri),
        decisionDate: published ? new Date(published) : null,
        judges: [],
        caseNumber: null,
        summary: decodeHtmlEntities(block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]?.trim() ?? title),
      });
    }

    return hits;
  }

  /**
   * Public HTML search page fallback. Peachjam often embeds JSON; also parse FRBR links.
   * Exported for unit tests via the private method call from search().
   */
  async searchViaHtmlPage(params: {
    query: string;
    docType?: 'judgment' | 'legislation';
    limit: number;
  }): Promise<KenyaLawSearchHit[]> {
    const url = new URL(SEARCH_HTML);
    url.searchParams.set('q', params.query);
    if (params.docType) url.searchParams.set('doc_type', params.docType);

    try {
      await kenyaLawRateLimit();
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(KenyaLawJudgmentConnector.TIMEOUT_MS),
        headers: kenyaLawFetchHeaders('text/html,application/xhtml+xml'),
      });
      if (!res.ok) {
        this.logger.warn(`Kenya Law HTML search returned ${res.status}`);
        return [];
      }
      const html = await res.text();
      const fromEmbedded = this.parseEmbeddedSearchJson(html, params.docType, params.limit);
      if (fromEmbedded.length > 0) return fromEmbedded;
      return this.parseSearchHtmlLinks(html, params.docType, params.limit);
    } catch (err) {
      this.logger.warn(
        `Kenya Law HTML search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /** @internal — unit-tested HTML/JSON parsers */
  parseEmbeddedSearchJson(
    html: string,
    docType: string | undefined,
    limit: number,
  ): KenyaLawSearchHit[] {
    const blobs: string[] = [];
    const scriptJson = [
      ...html.matchAll(
        /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ];
    for (const m of scriptJson) {
      if (m[1]) blobs.push(m[1]);
    }
    // Peachjam / Next-style hydration payloads sometimes embed results arrays.
    const resultsMatch = html.match(
      /"results"\s*:\s*(\[[\s\S]*?\])\s*,\s*"(?:count|next|previous|facets)"/i,
    );
    if (resultsMatch?.[1]) blobs.push(`{"results":${resultsMatch[1]}}`);

    for (const blob of blobs) {
      try {
        const parsed = JSON.parse(blob) as { results?: SearchApiRow[] } | SearchApiRow[];
        const rows = Array.isArray(parsed) ? parsed : parsed.results;
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const hits = rows
          .map((row) => this.toSearchHit(row))
          .filter((hit): hit is KenyaLawSearchHit => !!hit)
          .filter((hit) => !docType || hit.docType === docType || !hit.docType)
          .slice(0, limit);
        if (hits.length > 0) return hits;
      } catch {
        // try next blob
      }
    }
    return [];
  }

  /** @internal */
  parseSearchHtmlLinks(
    html: string,
    docType: string | undefined,
    limit: number,
  ): KenyaLawSearchHit[] {
    const preferJudgment = !docType || docType === 'judgment';
    const preferLegislation = docType === 'legislation';
    const hits: KenyaLawSearchHit[] = [];
    const seen = new Set<string>();
    const linkRe =
      /href="((?:https?:\/\/(?:new\.)?kenyalaw\.org)?\/akn\/ke\/(?:judgment|act)\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) !== null && hits.length < limit) {
      const path = match[1] ?? '';
      const titleRaw = stripHtml(match[2] ?? '');
      const expressionFrbrUri = frbrUriFromPublicUrl(path);
      if (seen.has(expressionFrbrUri)) continue;
      const isJudgment = expressionFrbrUri.includes('/judgment/');
      const isAct = expressionFrbrUri.includes('/act/');
      if (preferJudgment && !isJudgment) continue;
      if (preferLegislation && !isAct) continue;
      if (!isJudgment && !isAct) continue;
      seen.add(expressionFrbrUri);
      const title = titleRaw || expressionFrbrUri;
      hits.push({
        id: isJudgment
          ? judgmentIdFromFrbrUri(expressionFrbrUri)
          : `ke-doc-${expressionFrbrUri.replace(/\//g, '-')}`,
        docType: isJudgment ? 'judgment' : 'legislation',
        title,
        citation: extractCitationFromTitle(title),
        court: extractCourtFromTitle(title),
        sourceUrl: publicUrlFromFrbrUri(expressionFrbrUri),
        expressionFrbrUri,
        workFrbrUri: isJudgment
          ? workFrbrUriFromJudgmentExpression(expressionFrbrUri)
          : expressionFrbrUri.replace(/\/eng@[^/]+$/, ''),
        decisionDate: null,
        judges: [],
        caseNumber: null,
        summary: title,
      });
    }
    return hits;
  }

  private async searchViaJsonApi(params: {
    query: string;
    docType?: 'judgment' | 'legislation';
    limit: number;
    page: number;
  }): Promise<KenyaLawSearchHit[]> {
    const url = new URL(SEARCH_API);
    url.searchParams.set('search', params.query);
    url.searchParams.set('page', String(params.page));
    if (params.docType) {
      url.searchParams.set('doc_type', params.docType);
    }

    for (let attempt = 1; attempt <= KenyaLawJudgmentConnector.MAX_SEARCH_ATTEMPTS; attempt++) {
      try {
        await kenyaLawRateLimit();
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(KenyaLawJudgmentConnector.TIMEOUT_MS),
          headers: kenyaLawFetchHeaders('application/json'),
        });
        if (!res.ok) {
          this.logger.warn(
            `Kenya Law search returned ${res.status} for "${params.query}" (attempt ${attempt})`,
          );
          if (
            isKenyaLawRetryableStatus(res.status) &&
            attempt < KenyaLawJudgmentConnector.MAX_SEARCH_ATTEMPTS
          ) {
            await kenyaLawThrottleBackoff(res.status, attempt);
            continue;
          }
          return [];
        }

        const payload = (await res.json()) as { results?: SearchApiRow[] };
        const rows = payload.results ?? [];
        return rows
          .slice(0, params.limit)
          .map((row) => this.toSearchHit(row))
          .filter(Boolean) as KenyaLawSearchHit[];
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Kenya Law search failed for "${params.query}" (attempt ${attempt}): ${message}`,
        );
        if (attempt < KenyaLawJudgmentConnector.MAX_SEARCH_ATTEMPTS) {
          await kenyaLawThrottleBackoff(503, attempt);
          continue;
        }
        return [];
      }
    }
    return [];
  }

  private toSearchHit(row: SearchApiRow): KenyaLawSearchHit | null {
    const expressionFrbrUri = (row.expression_frbr_uri ?? '').replace(/^\/+/, '');
    if (!expressionFrbrUri) return null;

    const highlightSnippets = [
      ...(row.highlight?.['pages.body'] ?? []),
      ...(row.highlight?.['provisions.body'] ?? []),
    ]
      .map((snippet) => stripHtml(snippet))
      .filter(Boolean);

    const docType = row.doc_type ?? 'unknown';
    const id =
      docType === 'judgment'
        ? judgmentIdFromFrbrUri(expressionFrbrUri)
        : `ke-doc-${row.id ?? expressionFrbrUri.replace(/\//g, '-')}`;

    return {
      id,
      docType,
      title: decodeHtmlEntities(row.title ?? 'Kenya Law document'),
      citation: row.citation ? decodeHtmlEntities(row.citation) : extractCitationFromTitle(row.title ?? ''),
      court: row.court ? decodeHtmlEntities(row.court) : extractCourtFromTitle(row.title ?? ''),
      sourceUrl: publicUrlFromFrbrUri(expressionFrbrUri),
      expressionFrbrUri,
      workFrbrUri: (row.work_frbr_uri ?? workFrbrUriFromJudgmentExpression(expressionFrbrUri)).replace(
        /^\/+/,
        '',
      ),
      decisionDate: row.date ? new Date(row.date) : null,
      judges: (row.judges ?? []).map((name) => decodeHtmlEntities(name)),
      caseNumber: row.case_number?.[0] ? decodeHtmlEntities(row.case_number[0]) : null,
      summary: highlightSnippets.length > 0 ? highlightSnippets.join(' … ') : null,
    };
  }

  private async fetchHtml(sourceUrl: string): Promise<string | null> {
    try {
      await kenyaLawRateLimit();
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(KenyaLawJudgmentConnector.TIMEOUT_MS),
        headers: kenyaLawFetchHeaders(),
      });
      if (!res.ok) {
        this.logger.warn(`Kenya Law judgment fetch returned ${res.status} for ${sourceUrl}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      this.logger.error(`Kenya Law judgment fetch failed for ${sourceUrl}`, err);
      return null;
    }
  }
}

export function judgmentIdFromFrbrUri(expressionFrbrUri: string): string {
  const normalized = expressionFrbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  // akn / ke / judgment / court / year / number [/ eng@date ]
  if (parts.length >= 6 && parts[0] === 'akn' && parts[1] === 'ke' && parts[2] === 'judgment') {
    const court = parts[3];
    const year = parts[4];
    const number = parts[5];
    return `ke-judgment-${court}-${year}-${number}`.toLowerCase();
  }
  return normalized.replace(/\//g, '-').toLowerCase();
}

export function workFrbrUriFromJudgmentExpression(expressionFrbrUri: string): string {
  const normalized = expressionFrbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = normalized.split('/');
  const langIndex = parts.findIndex((part) => /^[a-z]{3}@/.test(part));
  if (langIndex >= 0) {
    return parts.slice(0, langIndex).join('/');
  }
  return normalized;
}

export function buildKenyaCaseAuthorityId(judgmentId: string): string {
  return `case-ke-${judgmentId}`;
}

function frbrUriFromPublicUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://new.kenyalaw.org');
    return parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  } catch {
    return url.replace(/^\/+/, '').replace(/\/+$/, '');
  }
}

function extractCitationFromTitle(title: string): string | null {
  const match = title.match(/\[\d{4}\]\s*[A-Z]+\s*\d+\s*\(KLR\)/);
  return match?.[0] ?? null;
}

function extractCourtFromTitle(title: string): string | null {
  const codeMatch = title.match(/\[\d{4}\]\s*([A-Z]+)\s*\d+/);
  const code = codeMatch?.[1];
  if (!code) return null;
  const map: Record<string, string> = {
    KECA: 'Court of Appeal',
    KEHC: 'High Court',
    KEELRC: 'Employment and Labour Relations Court',
    KESC: 'Supreme Court',
    KEMC: "Magistrate's Court",
    KETAT: 'Tax Appeals Tribunal',
    SCC: 'Small Claims Court',
  };
  return map[code] ?? code;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function htmlToPlainText(html: string): string {
  return stripHtml(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n'),
  );
}
