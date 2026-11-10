import { parseDocument, DomUtils } from 'htmlparser2';
import { createHash } from 'node:crypto';
import type { SourceProvenance } from '@/legal-search/legal-retrieval.types';
import { researchRequestSignal } from '@/common/utils/research-execution-budget';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectorSearchOutcome,
  ConnectorSearchStatus,
  emptyConnectorOutcome,
} from './connector-outcome.types';

export interface IndiaKanoonSearchParams {
  query: string;
  limit?: number;
  /** Skip per-doc detail fetch (judge names, enriched citation). Saves ~8s per query in FAST mode. */
  skipEnrich?: boolean;
  /** Fetch judgment body for evidence-pack passage ingest. */
  fetchFullText?: boolean;
}

export interface IndiaKanoonResult {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  sourceUrl: string;
  summary: string | null;
  judges: string[];
  decisionDate: Date | null;
  /** Full judgment text when fetchFullText was requested. */
  fullText?: string | null;
  /** Best-effort treatment hint from doc metadata / headline. */
  treatmentHint?: string | null;
  /** Passage text from docfragment endpoint (issue-specific excerpt). */
  fragmentText?: string | null;
  /** Source-preserved judgment paragraphs. `paragraph` is present only when supplied by the source. */
  passages?: IndiaKanoonPassage[];
  sourceProvenance?: SourceProvenance;
}

export interface IndiaKanoonPassage {
  text: string;
  paragraph?: string;
  /** True only for a paragraph identifier extracted from source markup/text. */
  sourcePinpoint: boolean;
}

interface IKSearchDoc {
  tid: number;
  title?: string;
  headline?: string;
  docsource?: string;
  publishdate?: string;
  citation?: string;
}

interface IKSearchResponse {
  docs?: IKSearchDoc[];
  found?: number;
}

interface IKDocFragmentResponse {
  tid?: number;
  title?: string;
  headline?: string;
  formInput?: string;
  doc?: string;
}

interface IKDocResponse {
  judgmentby?: string;
  fromappeal?: string;
  title?: string;
  docsource?: string;
  publishdate?: string;
  doc?: string;
  data?: string;
  judgment?: string;
}

@Injectable()
export class IndiaKanoonConnector {
  private readonly logger = new Logger(IndiaKanoonConnector.name);
  private readonly baseUrl = 'https://api.indiankanoon.org';
  private loggedConfigStatus = false;
  private failureCount = 0;
  private circuitOpenUntil = 0;
  private readonly resultCache = new Map<
    string,
    { expiresAt: number; results: IndiaKanoonResult[] }
  >();

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    // Opt-in only: official web research must not depend on a prepaid aggregator.
    if (String(this.configService.get('INDIA_KANOON_ENABLED') ?? 'false') !== 'true') return '';
    return (this.configService.get<string>('INDIA_KANOON_API_KEY', '') ?? '').trim();
  }

  isConfigured(): boolean {
    const configured = this.getApiKey().length > 0;
    if (!this.loggedConfigStatus) {
      this.loggedConfigStatus = true;
      if (configured) {
        this.logger.log('India Kanoon API key configured — live case-law search enabled');
      } else {
        this.logger.warn('Indian Kanoon disabled or API key missing — using other research sources');
      }
    }
    return configured;
  }

  /** True when the process-level circuit breaker is open (skip all further IK work). */
  isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  async search(params: IndiaKanoonSearchParams): Promise<IndiaKanoonResult[]> {
    const outcome = await this.searchWithOutcome(params);
    return outcome.results;
  }

  async searchWithOutcome(
    params: IndiaKanoonSearchParams,
  ): Promise<ConnectorSearchOutcome<IndiaKanoonResult>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return emptyConnectorOutcome('not_configured', 'Indian Kanoon is opt-in and requires an enabled, funded API key');
    }
    if (this.isCircuitOpen()) {
      this.logger.warn('India Kanoon circuit open — skipping live search');
      return emptyConnectorOutcome('circuit_open', 'Circuit breaker open after recent failures');
    }

    const limit = params.limit ?? 6;
    const skipEnrich = params.skipEnrich ?? false;
    const cacheKey = JSON.stringify([
      params.query.trim().toLowerCase(),
      limit,
      skipEnrich,
      params.fetchFullText ?? false,
    ]);
    const cached = this.resultCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        status: cached.results.length > 0 ? 'searched' : 'no_hits',
        results: cached.results,
        hitCount: cached.results.length,
        fromCache: true,
      };
    }

    try {
      const searchBody = new URLSearchParams({
        formInput: params.query,
        pagenum: '0',
        maxpages: '1',
        maxcites: '10',
      });

      const searchRes = await fetch(`${this.baseUrl}/search/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: searchBody.toString(),
        signal: researchRequestSignal(10_000),
      });

      if (!searchRes.ok) {
        this.failureCount += 1;
        const status = this.mapHttpStatus(searchRes.status);
        const authFailure = searchRes.status === 401 || searchRes.status === 403;
        if (authFailure || searchRes.status === 429 || this.failureCount >= 2) {
          const configuredCooldown = Number(
            this.configService.get('INDIA_KANOON_FAILURE_COOLDOWN_MS') ?? 60_000,
          );
          // Auth failures stay open longer — further queries cannot succeed this run.
          const authCooldown = Number(
            this.configService.get('INDIA_KANOON_AUTH_FAILURE_COOLDOWN_MS') ?? 300_000,
          );
          const cooldownMs = authFailure
            ? Math.max(
                60_000,
                Number.isFinite(authCooldown) ? authCooldown : 300_000,
              )
            : Math.max(
                10_000,
                Number.isFinite(configuredCooldown) ? configuredCooldown : 60_000,
              );
          this.circuitOpenUntil = Date.now() + cooldownMs;
          this.logger.warn(
            `India Kanoon circuit opened for ${cooldownMs}ms after HTTP ${searchRes.status}`,
          );
        }
        this.logger.warn(
          `India Kanoon search returned ${searchRes.status} for queryChars=${params.query.length}`,
        );
        return {
          ...emptyConnectorOutcome(status, `HTTP ${searchRes.status}`),
          httpStatus: searchRes.status,
        };
      }
      this.failureCount = 0;

      const data: IKSearchResponse = await searchRes.json();
      const docs = (data?.docs ?? []).slice(0, limit);
      const rawHitCount = data?.found ?? docs.length;
      if (docs.length === 0) {
        this.logger.debug(
          `India Kanoon search returned 0 docs (found=${rawHitCount}) queryChars=${params.query.length}`,
        );
      } else {
        this.logger.debug(
          `India Kanoon search docs=${docs.length} found=${rawHitCount} queryChars=${params.query.length}`,
        );
      }

      const fetchFullText = params.fetchFullText ?? false;
      const results: IndiaKanoonResult[] = skipEnrich && !fetchFullText
        ? docs.map((doc) => this.docToResult(doc))
        : await Promise.all(docs.map((doc) => this.enrichDoc(doc, apiKey, fetchFullText)));

      if (fetchFullText) {
        const withText = results.filter((r) => (r.fullText?.length ?? 0) > 0).length;
        this.logger.log(
          `India Kanoon search hits=${results.length} fullText=${withText} queryChars=${params.query.length}`,
        );
      }

      this.resultCache.set(cacheKey, {
        expiresAt: Date.now() + (results.length === 0 ? 30_000 : 5 * 60_000),
        results,
      });
      return {
        status: results.length > 0 ? 'searched' : 'no_hits',
        results,
        hitCount: rawHitCount,
      };
    } catch (err) {
      this.failureCount += 1;
      if (this.failureCount >= 2) {
        this.circuitOpenUntil = Date.now() + 60_000;
      }
      const message = err instanceof Error ? err.message : String(err);
      const status: ConnectorSearchStatus =
        err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'error';
      this.logger.error('India Kanoon search failed', err);
      return emptyConnectorOutcome(status, message);
    }
  }

  private mapHttpStatus(httpStatus: number): ConnectorSearchStatus {
    if (httpStatus === 401 || httpStatus === 403) return 'unauthorized';
    if (httpStatus === 429) return 'rate_limited';
    return 'error';
  }

  /** Fetch issue-specific passage excerpt for a judgment (docfragment API). */
  async fetchDocFragment(tid: number, formInput: string): Promise<string | null> {
    const apiKey = this.getApiKey();
    if (!apiKey || !formInput.trim()) return null;

    try {
      const res = await fetch(`${this.baseUrl}/docfragment/${tid}/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ formInput: formInput.trim().slice(0, 200) }).toString(),
        signal: researchRequestSignal(10_000),
      });

      if (!res.ok) return null;

      const data: IKDocFragmentResponse = await res.json();
      const raw = data.headline ?? data.doc ?? '';
      if (typeof raw !== 'string' || raw.trim().length < 40) return null;
      return htmlToText(raw).slice(0, 4000);
    } catch {
      return null;
    }
  }

  private docToResult(doc: IKSearchDoc): IndiaKanoonResult {
    const sourceUrl = `https://indiankanoon.org/doc/${doc.tid}/`;
    let decisionDate: Date | null = null;
    if (doc.publishdate) {
      const d = new Date(doc.publishdate);
      if (!isNaN(d.getTime())) decisionDate = d;
    }
    return {
      id: `ik-${doc.tid}`,
      title: doc.title ?? doc.headline ?? `Case ${doc.tid}`,
      citation: doc.citation ?? null,
      court: doc.docsource ?? null,
      sourceUrl,
      summary: doc.headline ?? null,
      judges: [],
      decisionDate,
    };
  }

  private async enrichDoc(
    doc: IKSearchDoc,
    apiKey: string,
    fetchFullText = false,
  ): Promise<IndiaKanoonResult> {
    const sourceUrl = `https://indiankanoon.org/doc/${doc.tid}/`;
    const judges: string[] = [];
    let citation: string | null = doc.citation ?? null;
    let decisionDate: Date | null = null;
    let court = doc.docsource ?? null;
    let fullText: string | null = null;
    let passages: IndiaKanoonPassage[] = [];
    let sourceProvenance: SourceProvenance | undefined;

    if (doc.publishdate) {
      const d = new Date(doc.publishdate);
      if (!isNaN(d.getTime())) {
        decisionDate = d;
      }
    }

    try {
      const docRes = await fetch(`${this.baseUrl}/doc/${doc.tid}/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ type: 'json' }).toString(),
        signal: researchRequestSignal(fetchFullText ? 15_000 : 8_000),
      });

      if (docRes.ok) {
        const detail: IKDocResponse = await docRes.json();

        if (detail.judgmentby) {
          // judgmentby is typically comma-separated names
          const rawJudges = detail.judgmentby
            .split(/,|;/)
            .map((j) => j.trim())
            .filter(Boolean);
          judges.push(...rawJudges);
        }

        if (!citation && detail.fromappeal) {
          citation = detail.fromappeal;
        }

        if (!court && detail.docsource) {
          court = detail.docsource;
        }

        if (!decisionDate && detail.publishdate) {
          const parsedDate = new Date(detail.publishdate);
          if (!Number.isNaN(parsedDate.getTime())) decisionDate = parsedDate;
        }

        if (fetchFullText) {
          const body = detail.doc ?? detail.data ?? detail.judgment ?? '';
          if (typeof body === 'string' && body.trim().length > 0) {
            passages = extractIndiaKanoonPassages(body);
            const documentText = htmlToText(body);
            fullText = documentText.slice(0, 100_000);
            const numbered = passages.filter((passage) => passage.sourcePinpoint);
            sourceProvenance = {
              provider: 'Indian Kanoon API', retrievedAt: new Date().toISOString(),
              canonicalIdentity: `ik-${doc.tid}`, canonicalUrl: sourceUrl,
              documentHash: createHash('sha256').update(documentText).digest('hex'),
              completeness: documentText.length <= 100_000 ? 'COMPLETE' : 'PARTIAL',
              extractionMethod: 'STRUCTURED_API', authoritativeStatus: 'AGGREGATOR',
              paragraphNumberingIntegrity: numbered.length > 0
                ? new Set(numbered.map((passage) => passage.paragraph)).size === numbered.length ? 'INTACT' : 'CORRUPT'
                : 'UNKNOWN',
              dispositionComplete: documentText.length <= 100_000 && /(?:appeal|petition|application|suit)\s+(?:(?:is|are|stands?|hereby)\s+)*(?:allowed|dismissed|disposed)|(?:appeal|petition)\s+(?:fails?|succeeds?)/i.test(documentText.slice(-4000)),
              extractorVersion: 'india-kanoon-document-v1',
            };
          }
        }
      }
    } catch {
      // enrichment is best-effort; proceed without it
    }

    const title = doc.title ?? doc.headline ?? `Case ${doc.tid}`;
    const treatmentHint = this.extractTreatmentHint(`${doc.headline ?? ''} ${title}`);

    return {
      id: `ik-${doc.tid}`,
      title,
      citation,
      court,
      sourceUrl,
      summary: doc.headline ?? null,
      judges,
      decisionDate,
      fullText,
      treatmentHint,
      passages,
      sourceProvenance,
    };
  }

  private extractTreatmentHint(text: string): string | null {
    const m = text.match(/\b(overruled|followed|affirmed|distinguished|doubted|reversed)\b/i);
    return m ? m[1].toLowerCase() : null;
  }
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Preserve source paragraph identifiers. Unnumbered HTML blocks remain useful
 * quoted passages but are never promoted to judicial pinpoints.
 */
export function extractIndiaKanoonPassages(html: string): IndiaKanoonPassage[] {
  const passages: IndiaKanoonPassage[] = [];
  const seen = new Set<string>();
  const blockTags = new Set(['p', 'div', 'blockquote']);
  const document = parseDocument(html);
  const blocks = DomUtils.findAll((node) => blockTags.has(node.name), document.children);

  for (const node of blocks) {
    const attributePinpoint = Object.entries(node.attribs)
      .filter(([name]) => /^(?:id|name|data-para(?:graph)?)$/i.test(name))
      .map(([, value]) => value.match(/^(?:para(?:graph)?|p)?[_:\-\s]*(\d+[A-Za-z]?)$/i)?.[1])
      .find(Boolean);
    // Wrappers must not consume nested source-numbered paragraphs.
    if (!attributePinpoint && DomUtils.findOne((child) => blockTags.has(child.name), node.children)) continue;
    const text = htmlToText(DomUtils.getInnerHTML(node));
    if (text.length < 30) continue;
    if (!attributePinpoint && passages.some((passage) => passage.sourcePinpoint && passage.text.includes(text))) continue;
    const textualPinpoint = text.match(/^\s*(?:para(?:graph)?\s*)?(?:\(|\[)?(\d+[A-Za-z]?)(?:\)|\]|[.:])\s+/i)?.[1];
    const paragraph = attributePinpoint ?? textualPinpoint;
    const key = `${paragraph ?? ''}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    passages.push({
      text: text.slice(0, 8_000),
      paragraph,
      sourcePinpoint: Boolean(paragraph),
    });
  }

  return passages;
}
