import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { extractPdfText } from './india-pdf.util';

export type RbiInstrumentType =
  | 'CIRCULAR'
  | 'MASTER_DIRECTION'
  | 'DIRECTION'
  | 'NOTIFICATION';

export interface RbiRegulationManifestEntry {
  id: string;
  title: string;
  regulator: 'Reserve Bank of India';
  instrumentType: RbiInstrumentType;
  instrumentNumber: string;
  issueDate: string;
  sourceUrl: string;
  topics: string[];
}

export interface RbiParagraphReference {
  paragraph: string;
  text: string;
}

export interface RbiRegulationDocument extends RbiRegulationManifestEntry {
  authorityType: 'REGULATION';
  decisionDate: string;
  fullText: string;
  paragraphReferences: RbiParagraphReference[];
}

export interface RbiRetrievalGap {
  entry: RbiRegulationManifestEntry;
  reason: string;
}

const RBI_HOSTS = new Set(['rbi.org.in', 'www.rbi.org.in']);
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

/**
 * Verified official RBI corpus manifest. Text is always fetched at runtime from
 * the official URL; metadata remains useful when RBI is temporarily unavailable.
 */
export const RBI_REGULATION_MANIFEST: readonly RbiRegulationManifestEntry[] = [
  {
    id: 'rbi-dbr-leg-bc-78-2017-18',
    title:
      'Customer Protection – Limiting Liability of Customers in Unauthorised Electronic Banking Transactions',
    regulator: 'Reserve Bank of India',
    instrumentType: 'CIRCULAR',
    instrumentNumber: 'DBR.No.Leg.BC.78/09.07.005/2017-18',
    issueDate: '2017-07-06',
    sourceUrl: 'https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11040&Mode=0',
    topics: [
      'unauthorised electronic banking transactions',
      'customer protection',
      'customer liability',
      'digital payments',
      'UPI',
    ],
  },
  {
    id: 'rbi-digital-lending-directions-2025',
    title: 'Reserve Bank of India (Digital Lending) Directions, 2025',
    regulator: 'Reserve Bank of India',
    instrumentType: 'DIRECTION',
    instrumentNumber: 'DOR.STR.REC.19/21.07.001/2025-26',
    issueDate: '2025-05-08',
    sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12848&Mode=0',
    topics: [
      'digital lending',
      'lending service providers',
      'digital lending applications',
      'borrower protection',
      'default loss guarantee',
    ],
  },
] as const;

export function isAllowedRbiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && RBI_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function buildRbiAuthorityId(entry: Pick<RbiRegulationManifestEntry, 'id'>): string {
  return `regulation-in-${entry.id}`;
}

@Injectable()
export class RbiRegulationConnector {
  private readonly logger = new Logger(RbiRegulationConnector.name);
  private consecutiveHttpFailures = 0;
  private circuitOpenUntil = 0;

  listManifest(): readonly RbiRegulationManifestEntry[] {
    return RBI_REGULATION_MANIFEST;
  }

  isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  async fetchDocument(entry: RbiRegulationManifestEntry): Promise<RbiRegulationDocument> {
    if (this.isCircuitOpen()) {
      throw new Error('RBI circuit open — skipping official fetch');
    }
    const response = await this.fetchOfficial(entry.sourceUrl);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    let fullText: string;
    if (contentType.includes('application/pdf') || response.url.toLowerCase().endsWith('.pdf')) {
      fullText = await extractPdfText(Buffer.from(await response.arrayBuffer()));
    } else {
      fullText = extractRbiHtmlText(await response.text());
    }
    fullText = normaliseExtractedText(fullText);
    if (fullText.length < 200) {
      throw new Error(`RBI extraction returned insufficient text for ${entry.id}`);
    }
    return {
      ...entry,
      authorityType: 'REGULATION',
      decisionDate: entry.issueDate,
      fullText,
      paragraphReferences: extractParagraphReferences(fullText),
    };
  }

  async fetchCorpus(): Promise<{
    documents: RbiRegulationDocument[];
    gaps: RbiRetrievalGap[];
  }> {
    const settled = await Promise.allSettled(
      RBI_REGULATION_MANIFEST.map((entry) => this.fetchDocument(entry)),
    );
    const documents: RbiRegulationDocument[] = [];
    const gaps: RbiRetrievalGap[] = [];
    settled.forEach((result, index) => {
      const entry = RBI_REGULATION_MANIFEST[index];
      if (result.status === 'fulfilled') {
        documents.push(result.value);
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        gaps.push({ entry, reason });
        this.logger.warn(`RBI retrieval gap id=${entry.id} reason="${reason}"`);
      }
    });
    return { documents, gaps };
  }

  async search(query: string, limit = 5): Promise<RbiRegulationDocument[]> {
    if (this.isCircuitOpen()) {
      this.logger.warn('RBI circuit open — skipping regulation search');
      return [];
    }
    const tokens = queryTokens(query);
    const ranked = RBI_REGULATION_MANIFEST.map((entry) => ({
      entry,
      score: scoreEntry(entry, tokens),
    }))
      .filter((row) => tokens.length === 0 || row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit));
    const settled = await Promise.allSettled(
      ranked.map(({ entry }) => this.fetchDocument(entry)),
    );
    return settled.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        this.consecutiveHttpFailures = 0;
        return [result.value];
      }
      this.logger.warn(
        `RBI search retrieval gap id=${ranked[index].entry.id} reason="${
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        }"`,
      );
      return [];
    });
  }

  private openCircuit(httpStatus: number): void {
    this.consecutiveHttpFailures += 1;
    // 418 / blocks and repeated failures → skip further RBI fan-out for this process.
    if (httpStatus !== 418 && httpStatus !== 403 && this.consecutiveHttpFailures < 2) {
      return;
    }
    this.circuitOpenUntil = Date.now() + 120_000;
    this.logger.warn(
      `RBI circuit opened for 120000ms after HTTP ${httpStatus} (failures=${this.consecutiveHttpFailures})`,
    );
  }

  private async fetchOfficial(sourceUrl: string): Promise<Response> {
    if (!isAllowedRbiUrl(sourceUrl)) {
      throw new Error(`Blocked non-RBI URL: ${sourceUrl}`);
    }
    let current = sourceUrl;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5',
          'User-Agent': 'LegalByOdaflow-RBI-Connector/1.0',
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`RBI redirect without Location (${response.status})`);
        const next = new URL(location, current).href;
        if (!isAllowedRbiUrl(next)) throw new Error(`Blocked RBI redirect target: ${next}`);
        current = next;
        continue;
      }
      if (!response.ok) {
        this.openCircuit(response.status);
        throw new Error(`RBI fetch failed (${response.status}) for ${current}`);
      }
      if (!isAllowedRbiUrl(response.url || current)) {
        throw new Error(`Blocked non-RBI response URL: ${response.url}`);
      }
      return response;
    }
    throw new Error(`RBI redirect limit exceeded for ${sourceUrl}`);
  }
}

function extractRbiHtmlText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    quot: '"',
    rsquo: '’',
    lsquo: '‘',
  };
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return named[entity.toLowerCase()] ?? match;
    });
}

function normaliseExtractedText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractParagraphReferences(fullText: string): RbiParagraphReference[] {
  const references: RbiParagraphReference[] = [];
  const pattern = /(?:^|\n)\s*(\d{1,3}(?:\.\d+)*)[.)]?\s+([^\n]{20,2000})/g;
  for (const match of fullText.matchAll(pattern)) {
    references.push({ paragraph: match[1], text: match[2].trim() });
  }
  return references.slice(0, 250);
}

function queryTokens(query: string): string[] {
  return [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
}

function scoreEntry(entry: RbiRegulationManifestEntry, tokens: string[]): number {
  const corpus = `${entry.title} ${entry.instrumentNumber} ${entry.topics.join(' ')}`.toLowerCase();
  return tokens.filter((token) => corpus.includes(token)).length;
}

export function rbiDocumentFingerprint(document: RbiRegulationDocument): string {
  return createHash('sha256').update(document.fullText).digest('hex');
}
