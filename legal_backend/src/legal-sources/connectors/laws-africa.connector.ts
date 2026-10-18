import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseAkomaNtosoSections } from '../parsers/akn-xml.parser';
import { ALL_STATUTES } from '@/legal-search/statute-registry';
import {
  actIdFromFrbrUri,
  expressionDate,
  natureFromFrbrUri,
  publicUrlFromFrbrUri,
  workFrbrUriFromExpression,
} from '../ke-frbr.util';
import type { KeManifestActEntry } from '../ke-manifest.types';
import type { StatuteSectionFetchResult } from './us-code.connector';

export interface LawsAfricaWorkExpression {
  title: string;
  work_title?: string;
  frbr_uri: string;
  expression_frbr_uri: string;
  nature?: string;
  year?: string;
  number?: string;
  updated_at?: string;
}

export interface LawsAfricaActDocument {
  originalContent: string;
  mediaType: 'application/akn+xml';
  sections: StatuteSectionFetchResult[];
  complete: boolean;
}

interface PaginatedWorkExpressions {
  count: number;
  next: string | null;
  results: LawsAfricaWorkExpression[];
}

/** Laws.Africa Content API — bulk Kenya legislation via Akoma Ntoso XML. */
@Injectable()
export class LawsAfricaConnector {
  private readonly logger = new Logger(LawsAfricaConnector.name);
  private readonly baseUrl = 'https://api.laws.africa';

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.getApiToken());
  }

  getApiToken(): string {
    return this.configService.get<string>('LAWS_AFRICA_API_TOKEN', '').trim();
  }

  private authHeaders(accept = 'application/json'): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiToken()}`,
      Accept: accept,
    };
  }

  private async fetchWithRetry(
    url: string,
    opts: { accept?: string; timeoutMs?: number; attempts?: number } = {},
  ): Promise<Response> {
    const accept = opts.accept ?? 'application/json';
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const attempts = opts.attempts ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: this.authHeaders(accept),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status >= 500 && attempt < attempts) {
          await sleep(attempt * 1_500);
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          this.logger.warn(
            `Laws.Africa fetch retry ${attempt}/${attempts} for ${url}: ${String(err)}`,
          );
          await sleep(attempt * 1_500);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** List every English expression returned by the API, retaining history. */
  async listLatestActExpressions(
    placeCode = 'ke',
    opts: { pageSize?: number; maxPages?: number } = {},
  ): Promise<LawsAfricaWorkExpression[]> {
    if (!this.isEnabled()) {
      throw new Error('LAWS_AFRICA_API_TOKEN is not configured');
    }

    const pageSize = opts.pageSize ?? 100;
    const maxPages = opts.maxPages ?? 200;
    const collected: LawsAfricaWorkExpression[] = [];

    let url: string | null =
      `${this.baseUrl}/v3/places/${placeCode}/work-expressions?page_size=${pageSize}`;
    let page = 0;

    while (url && page < maxPages) {
      page += 1;
      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Laws.Africa list failed (${response.status}): ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as PaginatedWorkExpressions;
      const acts = data.results.filter(
        (row) =>
          row.nature === 'act' &&
          row.expression_frbr_uri.includes('/act/') &&
          /\/eng@/.test(row.expression_frbr_uri),
      );
      collected.push(...acts);
      url = data.next;
    }

    return [...new Map(collected.map((row) => [row.expression_frbr_uri, row])).values()];
  }

  toManifestEntry(row: LawsAfricaWorkExpression): KeManifestActEntry {
    const expressionFrbrUri = row.expression_frbr_uri.replace(/^\/+/, '');
    const workFrbrUri = (row.frbr_uri || workFrbrUriFromExpression(expressionFrbrUri)).replace(
      /^\/+/,
      '',
    );
    const registryMatch = ALL_STATUTES.find(
      (statute) =>
        statute.countryCode === 'KE' &&
        (statute.frbrUri === expressionFrbrUri ||
          statute.frbrUri === workFrbrUri ||
          statute.sourceUrl === publicUrlFromFrbrUri(expressionFrbrUri)),
    );
    return {
      actId: registryMatch?.id ?? actIdFromFrbrUri(expressionFrbrUri),
      title: row.title || row.work_title || workFrbrUri,
      workFrbrUri,
      expressionFrbrUri,
      expressionDate: expressionDate(expressionFrbrUri),
      publicUrl: publicUrlFromFrbrUri(expressionFrbrUri),
      nature: natureFromFrbrUri(expressionFrbrUri),
      year: row.year,
      number: row.number,
    };
  }

  async buildManifestEntries(placeCode = 'ke'): Promise<KeManifestActEntry[]> {
    const rows = await this.listLatestActExpressions(placeCode);
    return rows.map((row) => this.toManifestEntry(row));
  }

  /** Fetch all sections for a work expression FRBR URI. */
  async fetchActSections(frbrUri: string): Promise<StatuteSectionFetchResult[]> {
    return (await this.fetchActDocument(frbrUri))?.sections ?? [];
  }

  async fetchActDocument(frbrUri: string): Promise<LawsAfricaActDocument | null> {
    const normalized = frbrUri.replace(/^\/+/, '').replace(/\/+$/, '');
    const publicUrl = publicUrlFromFrbrUri(normalized);

    if (this.isEnabled()) {
      const apiUrl = `${this.baseUrl}/v3/${normalized}.xml`;
      try {
        const response = await this.fetchWithRetry(apiUrl, {
          accept: 'application/xml',
          timeoutMs: 90_000,
        });
        if (response.ok) {
          const xml = await response.text();
          const sections = parseAkomaNtosoSections(xml, publicUrl);
          if (sections.length > 0) {
            return {
              originalContent: xml,
              mediaType: 'application/akn+xml',
              sections,
              complete: true,
            };
          }
          this.logger.warn(`Laws.Africa XML returned 0 sections for ${normalized}`);
        } else {
          this.logger.warn(`Laws.Africa XML fetch returned ${response.status} for ${normalized}`);
        }
      } catch (err) {
        this.logger.error(`Laws.Africa XML fetch failed for ${normalized}`, err);
      }
    }

    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
