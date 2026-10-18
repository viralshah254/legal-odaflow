import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  findManifestAct,
  resolveMirrorPdfUrl,
  resolvePrimaryPdfUrl,
} from '../india-manifest.loader';
import type { IndiaManifestSupplementaryAuthority } from '../india-manifest.types';
import {
  assessActSectionQuality,
  IN_INCOME_TAX_PRIORITY_SECTIONS,
  isUsableActSection,
  parseConstitutionTextIntoSections,
} from '../parsers/india-act-text.parser';
import {
  parseActTextIntoProvisions,
  provisionsToLegacySections,
} from '../parsers/india-act-structure.parser';
import { truncateAtSentence } from '@/legal-search/text-truncate';
import { extractPdfText, fetchPdfBuffer, hashText } from './india-pdf.util';
import { IndiaCodeConnector } from './india-code.connector';
import type { StatuteSectionFetchResult } from './us-code.connector';

export interface ConstitutionIngestMeta {
  editionDate?: string;
  lastEnactedAmendment?: string;
  lastAmendmentCommencement?: string;
  amendmentCount?: number;
  sourceUrl: string;
  sha256?: string;
}

@Injectable()
export class LegislativeDeptConnector {
  private readonly logger = new Logger(LegislativeDeptConnector.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly indiaCode: IndiaCodeConnector,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_LEGISLATIVE_DEPT_CONNECTOR', 'true') === 'true';
  }

  async fetchConstitutionSections(): Promise<{
    sections: StatuteSectionFetchResult[];
    meta: ConstitutionIngestMeta;
    supplementary: IndiaManifestSupplementaryAuthority[];
  }> {
    if (!this.isEnabled()) {
      return { sections: [], meta: { sourceUrl: '' }, supplementary: [] };
    }

    const entry = findManifestAct('constitution');
    if (!entry) {
      return { sections: [], meta: { sourceUrl: '' }, supplementary: [] };
    }

    const urls = [entry.primaryPdfUrl, entry.fallbackPdfUrl].filter(Boolean) as string[];
    let lastError: unknown;

    for (const url of urls) {
      try {
        const { buffer, sha256 } = await fetchPdfBuffer(url, 90_000);
        const rawText = await extractPdfText(buffer);
        const parsedSections = parseConstitutionTextIntoSections(rawText);
        const sections = parsedSections.filter(isUsableActSection);
        const quality = assessActSectionQuality(sections, {
          additionalHeadingOnly: parsedSections.length - sections.length,
        });
        if (!quality.acceptable) {
          this.logger.error(
            `Rejecting Constitution parse: ${quality.headingOnly}/${quality.total} heading-only sections`,
          );
          continue;
        }
        const fetchedSections = sections.map((section) => ({
          section: section.section,
          title: section.title,
          summary: truncateAtSentence(section.fullText, 400),
          fullText: section.fullText,
          sourceUrl: url,
          sourceName: 'Legislative Department (COI 2024)',
          contentHash: hashText(section.fullText),
          isRepealed: section.isRepealed,
          repealNotes: section.repealNotes,
        }));

        return {
          sections: fetchedSections,
          meta: {
            editionDate: entry.editionDate,
            lastEnactedAmendment: entry.lastEnactedAmendment,
            lastAmendmentCommencement: entry.lastAmendmentCommencement,
            amendmentCount: entry.amendmentCount,
            sourceUrl: url,
            sha256,
          },
          supplementary: entry.supplementaryAuthorities ?? [],
        };
      } catch (err) {
        lastError = err;
        this.logger.warn(`Constitution fetch failed for ${url}`, err);
      }
    }

    this.logger.error('All Constitution PDF URLs failed', lastError);
    return { sections: [], meta: { sourceUrl: urls[0] ?? '' }, supplementary: [] };
  }

  async fetchManifestActSections(actId: string): Promise<StatuteSectionFetchResult[]> {
    if (!this.isEnabled()) return [];

    const entry = findManifestAct(actId);
    if (!entry) return [];

    // Full parse for bundled local PDFs; priority list only for remote fallback ingest.
    const prioritySections: readonly string[] | undefined =
      actId === 'income-tax-act-1961' && !entry.localPdfPath
        ? IN_INCOME_TAX_PRIORITY_SECTIONS
        : undefined;

    const parsePdf = async (buffer: Buffer, sourceUrl: string) => {
      this.logger.log(`Parsing PDF for ${actId} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)…`);
      const rawText = await extractPdfText(buffer);
      this.logger.log(`Extracted ${rawText.length.toLocaleString()} chars from ${actId} PDF`);
      let rejectedHeadingOnlySections = 0;
      const sections = (() => {
        if (entry.documentType === 'constitution') {
          return parseConstitutionTextIntoSections(rawText);
        }
        const parsed = parseActTextIntoProvisions(rawText, { prioritySections });
        rejectedHeadingOnlySections = parsed.quality.rejectedHeadingOnlySections;
        return provisionsToLegacySections(parsed.provisions);
      })();
      const quality = assessActSectionQuality(sections, {
        additionalHeadingOnly: rejectedHeadingOnlySections,
      });
      if (!quality.acceptable) {
        this.logger.error(
          `Rejecting broken parse for ${actId}: ${quality.headingOnly}/${quality.total} heading-only sections (${(quality.stubRatio * 100).toFixed(1)}%)`,
        );
        return [];
      }

      const sourceName = entry.localPdfPath
        ? 'India corpus PDF'
        : entry.sourceAuthority === 'prsindia'
          ? 'PRS India'
          : entry.sourceAuthority === 'legislative-department'
            ? 'Legislative Department'
            : 'India Code';

      return sections.map((section) => ({
        section: section.section,
        title: section.title,
        summary: truncateAtSentence(section.fullText, 400),
        fullText: section.fullText,
        sourceUrl,
        sourceName,
        contentHash: hashText(section.fullText),
        isRepealed: section.isRepealed,
        repealNotes: section.repealNotes,
      }));
    };

    // Local corpus PDF takes highest priority — no network dependency.
    if (entry.localPdfPath) {
      try {
        const absPath = resolve(process.cwd(), entry.localPdfPath);
        this.logger.log(`Reading local corpus PDF for ${actId} from ${absPath}…`);
        const buffer = readFileSync(absPath);
        const result = await parsePdf(buffer, `file://${absPath}`);
        if (result.length > 0) return result;
        this.logger.error(
          `Local PDF yielded 0 sections for ${actId}; not falling back to mirrors (localPdfPath policy)`,
        );
      } catch (err) {
        this.logger.warn(`Local PDF read failed for ${actId}: ${err}`);
      }
      return [];
    }

    const rawUrls = [entry.primaryPdfUrl, entry.fallbackPdfUrl, entry.mirrorPdfUrl].filter(
      Boolean,
    ) as string[];

    const urls: string[] = [];
    for (const url of rawUrls) {
      if (url.includes('/handle/')) {
        const bitstream = await this.indiaCode.resolveBitstreamExternalId(url);
        if (bitstream) {
          urls.push(this.indiaCode.resolveActUrl(bitstream));
          continue;
        }
        continue;
      }
      urls.push(url);
    }

    if (entry.externalId) {
      urls.push(this.indiaCode.resolveActUrl(entry.externalId));
    }

    for (const url of urls) {
      try {
        this.logger.log(`Downloading PDF for ${actId} from ${url}…`);
        const { buffer } = await fetchPdfBuffer(url, 90_000);
        const result = await parsePdf(buffer, url);
        if (result.length > 0) return result;
      } catch (err) {
        this.logger.warn(`Manifest PDF fetch failed for ${actId} at ${url}`, err);
      }
    }

    return [];
  }

  getMirrorUrl(actId: string): string | undefined {
    return resolveMirrorPdfUrl(actId);
  }

  /**
   * HEAD-request the COI_2024 PDF to check whether the file has changed
   * since last ingest, and return structured freshness metadata.
   *
   * Run periodically (e.g. weekly) to detect when a newer COI edition
   * (COI_2025, COI_2026) becomes available on the Legislative Dept hub.
   */
  async checkConstitutionFreshness(): Promise<{
    available: boolean;
    url: string;
    lastModified?: string;
    contentLength?: number;
    hubUrl: string;
    note: string;
  }> {
    const entry = findManifestAct('constitution');
    const url = entry?.primaryPdfUrl ?? '';
    const HUB_URL = 'https://lddashboard.legislative.gov.in/constitution-of-india';

    if (!url) {
      return {
        available: false,
        url,
        hubUrl: HUB_URL,
        note: 'Constitution entry missing from manifest.',
      };
    }

    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        return {
          available: false,
          url,
          hubUrl: HUB_URL,
          note: `HEAD request returned ${response.status}.`,
        };
      }
      return {
        available: true,
        url,
        lastModified: response.headers.get('last-modified') ?? undefined,
        contentLength: Number(response.headers.get('content-length')) || undefined,
        hubUrl: HUB_URL,
        note:
          'Compare lastModified against stored ingest date. If changed, re-run: npm run ingest:india-manifest -- --act constitution. Also check hub URL for newer COI_2025/COI_2026 editions.',
      };
    } catch (err) {
      this.logger.warn('Constitution freshness check failed', err);
      return {
        available: false,
        url,
        hubUrl: HUB_URL,
        note: `Freshness check error: ${String(err)}`,
      };
    }
  }
}
