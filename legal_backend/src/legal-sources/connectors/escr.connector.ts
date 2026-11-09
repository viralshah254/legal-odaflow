import { researchRequestSignal } from '@/common/utils/research-execution-budget';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AWS_METADATA_BASE =
  'https://indian-supreme-court-judgments.s3.amazonaws.com/metadata/json';
const AWS_INDEX_BASE =
  'https://indian-supreme-court-judgments.s3.amazonaws.com/metadata/tar';
const SCR_BASE = 'https://scr.sci.gov.in';

export interface EscrSearchHit {
  id: string;
  title: string;
  citation: string | null;
  neutralCitation: string | null;
  court: string | null;
  sourceUrl: string;
  decisionDate: Date | null;
  judges: string[];
  summary: string | null;
  metadataPath: string;
}

export interface EscrJudgmentBody {
  title: string;
  citation: string | null;
  neutralCitation: string | null;
  court: string | null;
  sourceUrl: string;
  fullText: string;
  judges: string[];
  decisionDate: Date | null;
  treatmentHints: string[];
}

export function isCompleteEscrCaseHit(
  hit: Pick<EscrSearchHit, 'title' | 'court' | 'decisionDate' | 'citation' | 'sourceUrl'>,
): boolean {
  const parties = hit.title.match(/^(.+?)\s+(?:v(?:s\.?|ersus)?\.?)\s+(.+)$/i);
  return Boolean(
    parties?.[1]?.trim() &&
      parties?.[2]?.trim() &&
      hit.court?.trim() &&
      hit.decisionDate instanceof Date &&
      !Number.isNaN(hit.decisionDate.getTime()) &&
      hit.citation?.trim() &&
      /^https?:\/\//i.test(hit.sourceUrl),
  );
}

interface AwsMetadataJson {
  path?: string;
  raw_html?: string;
  citation_year?: string;
  nc_display?: string;
  scraped_at?: string;
}

interface AwsIndexJson {
  year?: number;
  parts?: Array<{ files?: string[] }>;
}

@Injectable()
export class EscrConnector {
  private readonly logger = new Logger(EscrConnector.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const disabled = this.configService.get<string>('ESCR_CONNECTOR_DISABLED', 'false');
    return disabled !== 'true';
  }

  /** List metadata JSON keys for a given year from the public AWS Open Data bucket. */
  async listMetadataFiles(year: number): Promise<string[]> {
    try {
      const res = await fetch(`${AWS_INDEX_BASE}/year=${year}/metadata.index.json`, {
        signal: researchRequestSignal(30_000),
      });
      if (!res.ok) {
        this.logger.warn(`e-SCR AWS index returned ${res.status} for year=${year}`);
        return [];
      }
      const payload = (await res.json()) as AwsIndexJson;
      const files: string[] = [];
      for (const part of payload.parts ?? []) {
        files.push(...(part.files ?? []));
      }
      return files;
    } catch (err) {
      this.logger.error(`e-SCR AWS index fetch failed for year=${year}`, err);
      return [];
    }
  }

  /** Fetch and parse one metadata JSON file from AWS. */
  async fetchMetadata(metadataFile: string, year: number): Promise<EscrSearchHit | null> {
    const path = metadataFile.replace(/\.json$/i, '');
    const url = `${AWS_METADATA_BASE}/year=${year}/${metadataFile}`;
    try {
      const res = await fetch(url, { signal: researchRequestSignal(20_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as AwsMetadataJson;
      return this.parseMetadata(data, path);
    } catch (err) {
      this.logger.debug(`e-SCR metadata fetch failed for ${metadataFile}: ${String(err)}`);
      return null;
    }
  }

  /** Search by neutral citation (e.g. 2024INSC199) against AWS metadata for recent years. */
  async searchByNeutralCitation(neutralCitation: string): Promise<EscrSearchHit[]> {
    const normalized = neutralCitation.replace(/\s+/g, '').toUpperCase();
    const yearMatch = normalized.match(/^(\d{4})INSC/i);
    const years = yearMatch
      ? [parseInt(yearMatch[1], 10)]
      : [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

    const hits: EscrSearchHit[] = [];
    for (const year of years) {
      const files = await this.listMetadataFiles(year);
      const candidates = files.filter((f) => f.includes(String(year)));
      for (const file of candidates.slice(0, 200)) {
        const hit = await this.fetchMetadata(file, year);
        if (hit?.neutralCitation?.replace(/\s+/g, '').toUpperCase() === normalized) {
          hits.push(hit);
        }
      }
      if (hits.length > 0) break;
    }
    return hits;
  }

  /** Search AWS metadata across recent years when no explicit year is supplied. */
  async searchJudgmentsBroad(query: string, limit = 10): Promise<EscrSearchHit[]> {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 8 }, (_, index) => currentYear - index);
    const hits: EscrSearchHit[] = [];
    for (const year of years) {
      const yearHits = await this.searchJudgments(query, limit, year);
      for (const hit of yearHits) {
        if (!hits.some((existing) => existing.id === hit.id)) {
          hits.push(hit);
        }
      }
      if (hits.length >= limit) break;
    }
    return hits.slice(0, limit);
  }

  /** Search AWS metadata by query tokens against title/summary in raw_html. */
  async searchJudgments(query: string, limit = 10, year?: number): Promise<EscrSearchHit[]> {
    const targetYear = year ?? new Date().getFullYear();
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (tokens.length === 0) return [];

    const files = await this.listMetadataFiles(targetYear);
    const hits: EscrSearchHit[] = [];

    for (const file of files) {
      if (hits.length >= limit * 3) break;
      const hit = await this.fetchMetadata(file, targetYear);
      if (!hit) continue;
      const corpus = `${hit.title} ${hit.summary ?? ''} ${hit.citation ?? ''}`.toLowerCase();
      const score = tokens.filter((t) => corpus.includes(t)).length;
      if (score > 0) {
        hits.push(hit);
      }
    }

    return hits.filter(isCompleteEscrCaseHit).slice(0, limit);
  }

  /** Resolve reporter citation like (2024) 3 SCR 627 from metadata path or query. */
  async lookupByReporterCitation(citation: string): Promise<EscrSearchHit | null> {
    const scrMatch = citation.match(/\((\d{4})\)\s*(\d+)\s*SCR\s*(\d+)/i);
    if (scrMatch) {
      const [, year, vol, page] = scrMatch;
      const path = `${year}_${vol}_${page}`;
      const files = await this.listMetadataFiles(parseInt(year, 10));
      const matchFile = files.find((f) => f.startsWith(`${path}_`) || f.startsWith(`${path}.`));
      if (matchFile) {
        const hit = await this.fetchMetadata(matchFile, parseInt(year, 10));
        return hit && isCompleteEscrCaseHit(hit) ? hit : null;
      }
    }

    const sccMatch = citation.match(/\((\d{4})\)\s*(\d+)\s*SCC\s*(\d+)/i);
    if (sccMatch) {
      const year = parseInt(sccMatch[1], 10);
      const hits = await this.searchJudgments(citation, 5, year);
      const exact = hits.find(
        (h) => h.citation && normaliseCite(h.citation) === normaliseCite(citation),
      );
      const hit = exact ?? hits[0] ?? null;
      return hit && isCompleteEscrCaseHit(hit) ? hit : null;
    }

    return null;
  }

  async fetchJudgmentBody(hit: EscrSearchHit): Promise<EscrJudgmentBody | null> {
    const year = hit.metadataPath.match(/^(\d{4})_/)?.[1];
    if (!year) return null;

    const file = `${hit.metadataPath}.json`;
    const url = `${AWS_METADATA_BASE}/year=${year}/${file}`;
    try {
      const res = await fetch(url, { signal: researchRequestSignal(25_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as AwsMetadataJson;
      const parsed = parseRawHtml(data.raw_html ?? '');
      if (!parsed.fullText || parsed.fullText.length < 80) return null;

      return {
        title: parsed.title || hit.title,
        citation: parsed.citation ?? hit.citation,
        neutralCitation: data.nc_display ?? hit.neutralCitation,
        court: 'Supreme Court of India',
        sourceUrl: hit.sourceUrl,
        fullText: parsed.fullText,
        judges: parsed.judges,
        decisionDate: parsed.decisionDate ?? hit.decisionDate,
        treatmentHints: parsed.treatmentHints,
      };
    } catch (err) {
      this.logger.warn(`e-SCR body fetch failed for ${hit.id}: ${String(err)}`);
      return null;
    }
  }

  private parseMetadata(data: AwsMetadataJson, path: string): EscrSearchHit | null {
    const parsed = parseRawHtml(data.raw_html ?? '');
    const neutralCitation = data.nc_display ?? null;
    const id = path.replace(/_/g, '-').toLowerCase();

    const hit: EscrSearchHit = {
      id: `escr-${id}`,
      title: parsed.title || path,
      citation: parsed.citation,
      neutralCitation,
      court: 'Supreme Court of India',
      sourceUrl: `${SCR_BASE}/scrsearch/?path=${encodeURIComponent(path)}`,
      decisionDate: parsed.decisionDate,
      judges: parsed.judges,
      summary: parsed.summary,
      metadataPath: path,
    };
    if (!isCompleteEscrCaseHit(hit)) {
      this.logger.debug(`e-SCR metadata rejected by citation gate: ${path}`);
      return null;
    }
    return hit;
  }
}

export function buildEscrAuthorityId(hitId: string): string {
  const slug = hitId.startsWith('escr-') ? hitId.slice(5) : hitId;
  return `case-in-escr-${slug}`;
}

function normaliseCite(citation: string): string {
  return citation.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]/g, '').trim();
}

function parseRawHtml(rawHtml: string): {
  title: string;
  citation: string | null;
  summary: string | null;
  fullText: string;
  judges: string[];
  decisionDate: Date | null;
  treatmentHints: string[];
} {
  const text = decodeHtmlEntities(rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

  const titleMatch = text.match(
    /([A-Z][A-Za-z0-9\s.'&,\-()/]+?)\s+(?:versus|vs\.?|v\.)\s+([A-Z][A-Za-z0-9\s.'&,\-()/]+?)(?:\s+-\s+\[|\s+Coram|\s+\(\d{4}\))/i,
  );
  const title = titleMatch
    ? `${titleMatch[1].trim()} v. ${titleMatch[2].trim()}`
    : text.slice(0, 120).trim();

  const scrCitation =
    text.match(/\[\d{4}\]\s*\d+\s*S\.?C\.?R\.?\s*\d+/i)?.[0] ??
    text.match(/\(\d{4}\)\s*\d+\s*S\.?C\.?R\.?\s*\d+/i)?.[0] ??
    null;
  const sccCitation = text.match(/\(\d{4}\)\s*\d+\s*SCC\s*\d+/i)?.[0] ?? null;
  const citation = sccCitation ?? scrCitation;

  const issueMatch = text.match(/Issue for Consideration\s+(.{40,400}?)(?:Decision Date|Headnotes|$)/i);
  const summary = issueMatch?.[1]?.trim() ?? text.slice(0, 500);

  const dateMatch = text.match(/Decision Date\s*:\s*(\d{2}-\d{2}-\d{4})/i);
  let decisionDate: Date | null = null;
  if (dateMatch) {
    const d = new Date(dateMatch[1].split('-').reverse().join('-'));
    if (!isNaN(d.getTime())) decisionDate = d;
  }

  const coramMatch = text.match(/Coram\s*:\s*([^|]+?)(?:Issue|Decision|$)/i);
  const judges = coramMatch
    ? coramMatch[1]
        .split(/[,*]/)
        .map((j) => j.trim())
        .filter((j) => j.length > 2)
    : [];

  const treatmentHints: string[] = [];
  for (const word of ['overruled', 'followed', 'distinguished', 'reversed', 'affirmed']) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) treatmentHints.push(word.toLowerCase());
  }

  return {
    title,
    citation,
    summary,
    fullText: text.slice(0, 50_000),
    judges,
    decisionDate,
    treatmentHints,
  };
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
