import { Injectable, Logger } from '@nestjs/common';
import { ALL_STATUTES } from '@/legal-search/statute-registry';
import {
  expressionDate,
  natureFromFrbrUri,
  publicUrlFromFrbrUri,
  toKeManifestEntry,
  workFrbrUriFromExpression,
} from '../ke-frbr.util';
import type { KeManifestActEntry } from '../ke-manifest.types';
import { kenyaLawFetchHeaders, kenyaLawRateLimit, configureKenyaLawRateLimit, isKenyaLawRetryableStatus, kenyaLawThrottleBackoff } from './kenya-law-rate-limit';

export interface KenyaCatalogRow {
  title: string;
  expressionFrbrUri: string;
  capCitation?: string;
}

/** Same catalog as kenyalaw.org/legislation/ — hosted on new.kenyalaw.org. */
const CATALOG_URL = 'https://new.kenyalaw.org/legislation/all';
const DEFAULT_MAX_PAGES = 12;
const ROW_RE =
  /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const ACT_LINK_RE =
  /cell-title">\s*<a href="(\/akn\/ke\/act\/[^"]+)">([^<]+)<\/a>/i;
const CAP_CITATION_RE = /cell-citation">([^<]*)/i;

/** Scrapes the public Kenya Law legislation catalog (no API token required). */
@Injectable()
export class KenyaLawCatalogConnector {
  private readonly logger = new Logger(KenyaLawCatalogConnector.name);
  private static readonly TIMEOUT_MS = 45_000;

  /** Crawl paginated Laws of Kenya listing and return deduplicated act rows. */
  async discoverActs(opts: { maxPages?: number; delayMs?: number } = {}): Promise<KenyaCatalogRow[]> {
    const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
    const collected: KenyaCatalogRow[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await this.fetchHtml(`${CATALOG_URL}?page=${page}`, opts.delayMs);
      if (!html) break;

      const pageRows = this.parseCatalogPage(html);
      if (pageRows.length === 0) break;

      collected.push(...pageRows);
      this.logger.log(`Kenya Law catalog page ${page}: ${pageRows.length} rows`);
    }

    const deduped = this.dedupeRows(collected);
    this.logger.log(`Discovered ${deduped.length} unique Kenya acts from public catalog`);
    return deduped;
  }

  async buildManifestEntries(
    opts: { includeSubsidiary?: boolean; delayMs?: number } = {},
  ): Promise<KeManifestActEntry[]> {
    const rows = await this.discoverActs({ delayMs: opts.delayMs });
    const entries = rows
      .filter((row) =>
        opts.includeSubsidiary
          ? isIngestableKenyaLegislation(row.expressionFrbrUri)
          : isIngestableKenyaAct(row.expressionFrbrUri),
      )
      .map((row) => this.toManifestEntry(row));

    const primaryActs = entries.filter((e) => e.nature === 'act' || e.nature === 'constitution').length;
    const subsidiary = entries.length - primaryActs;
    this.logger.log(
      `Manifest: ${entries.length} entries (${primaryActs} primary, ${subsidiary} subsidiary) from ${rows.length} catalog rows`,
    );

    if (opts.includeSubsidiary && entries.length < 490) {
      this.logger.warn(
        `Expected ~496 ingestable documents with subsidiary; got ${entries.length}. Catalog may have changed.`,
      );
    }

    return entries;
  }

  parseCatalogPage(html: string): KenyaCatalogRow[] {
    const rows: KenyaCatalogRow[] = [];
    let match: RegExpExecArray | null;

    while ((match = ROW_RE.exec(html)) !== null) {
      const rowHtml = match[1] ?? '';
      const link = rowHtml.match(ACT_LINK_RE);
      if (!link) continue;

      const href = link[1].trim();
      const title = decodeHtmlEntities(link[2].trim());
      const capMatch = rowHtml.match(CAP_CITATION_RE);
      const capCitation = capMatch?.[1]?.trim() || undefined;

      rows.push({
        title,
        expressionFrbrUri: href.replace(/^\/+/, ''),
        capCitation,
      });
    }

    return rows;
  }

  toManifestEntry(row: KenyaCatalogRow): KeManifestActEntry {
    const registryMatch = ALL_STATUTES.find(
      (statute) =>
        statute.countryCode === 'KE' &&
        (statute.frbrUri === row.expressionFrbrUri ||
          statute.frbrUri === workFrbrUriFromExpression(row.expressionFrbrUri) ||
          statute.sourceUrl === publicUrlFromFrbrUri(row.expressionFrbrUri) ||
          (row.capCitation &&
            statute.acronyms.some((alias) =>
              row.capCitation!.toLowerCase().includes(alias.replace(/\./g, '').toLowerCase()),
            ))),
    );

    return toKeManifestEntry({
      actId: registryMatch?.id,
      title: row.title,
      expressionFrbrUri: row.expressionFrbrUri,
      capCitation: row.capCitation,
      nature: natureFromFrbrUri(row.expressionFrbrUri),
    });
  }

  private dedupeRows(rows: KenyaCatalogRow[]): KenyaCatalogRow[] {
    const byWork = new Map<string, KenyaCatalogRow>();

    for (const row of rows) {
      const workUri = workFrbrUriFromExpression(row.expressionFrbrUri);
      const existing = byWork.get(workUri);
      if (!existing) {
        byWork.set(workUri, row);
        continue;
      }

      const existingDate = expressionDate(existing.expressionFrbrUri);
      const candidateDate = expressionDate(row.expressionFrbrUri);
      if (candidateDate >= existingDate) {
        byWork.set(workUri, row);
      }
    }

    return [...byWork.values()];
  }

  private async fetchHtml(url: string, delayMs?: number): Promise<string | null> {
    if (delayMs !== undefined) {
      configureKenyaLawRateLimit(delayMs);
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await kenyaLawRateLimit();
        const res = await fetch(url, {
          signal: AbortSignal.timeout(KenyaLawCatalogConnector.TIMEOUT_MS),
          headers: kenyaLawFetchHeaders(),
        });
        if (isKenyaLawRetryableStatus(res.status) && attempt < 3) {
          this.logger.warn(`Kenya Law catalog throttled (${res.status}) for ${url}, retry ${attempt}/3`);
          await kenyaLawThrottleBackoff(res.status, attempt);
          continue;
        }
        if (!res.ok) {
          this.logger.warn(`Kenya Law catalog fetch returned ${res.status} for ${url}`);
          return null;
        }
        return await res.text();
      } catch (err) {
        if (attempt < 3) {
          this.logger.warn(`Kenya Law catalog fetch retry ${attempt}/3 for ${url}`);
          await kenyaLawThrottleBackoff(503, attempt);
          continue;
        }
        this.logger.error(`Kenya Law catalog fetch failed for ${url}`, err);
        return null;
      }
    }
    return null;
  }
}

/** Primary statutes only — excludes legal notices, gazette notices, and corrigenda. */
export function isIngestableKenyaAct(expressionFrbrUri: string): boolean {
  const uri = expressionFrbrUri.replace(/^\/+/, '');
  if (uri.includes('/ln/') || uri.includes('/corr/') || uri.includes('/gn/')) return false;
  if (uri.startsWith('akn/ke/act/2010/constitution')) return true;
  return /\/akn\/ke\/act\/\d{4}\/\d+\/eng@/.test(`/${uri}`);
}

/** All ingestable Kenya legislation including subsidiary legal notices. */
export function isIngestableKenyaLegislation(expressionFrbrUri: string): boolean {
  const uri = expressionFrbrUri.replace(/^\/+/, '');
  if (uri.includes('/corr/')) return false;
  if (uri.startsWith('akn/ke/act/2010/constitution')) return true;
  if (uri.includes('/ln/') || uri.includes('/gn/')) return /\/eng@/.test(uri);
  return /\/akn\/ke\/act\/\d{4}\/\d+\/eng@/.test(`/${uri}`);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
