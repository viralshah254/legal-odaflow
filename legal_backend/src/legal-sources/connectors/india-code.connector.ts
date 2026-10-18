import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  htmlToPlainText,
  IN_INCOME_TAX_PRIORITY_SECTIONS,
  parseActTextIntoSections,
} from '../parsers/india-act-text.parser';
import { fetchFollowingRedirects } from './india-pdf.util';
import { truncateAtSentence } from '@/legal-search/text-truncate';
import type { StatuteSectionFetchResult } from './us-code.connector';

export interface IndiaCodeActMeta {
  actId: string;
  title: string;
  year?: number;
  sourceUrl: string;
  externalId?: string;
}

export interface IndiaCodeFetchOptions {
  prioritySections?: readonly string[];
  priorityOnly?: boolean;
}

@Injectable()
export class IndiaCodeConnector {
  private readonly logger = new Logger(IndiaCodeConnector.name);
  private readonly baseUrl = 'https://www.indiacode.nic.in';

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_INDIA_CODE_CONNECTOR', 'true') === 'true';
  }

  resolveActUrl(externalId: string): string {
    const path = externalId.startsWith('bitstream/') ? externalId : `bitstream/${externalId}`;
    return `${this.baseUrl}/${path}`;
  }

  /** Resolve an India Code handle landing page to a bitstream PDF path. */
  async resolveBitstreamExternalId(sourceUrl: string): Promise<string | null> {
    if (!sourceUrl.includes('indiacode.nic.in')) return null;
    if (sourceUrl.includes('/bitstream/')) {
      const path = sourceUrl.split('indiacode.nic.in/').pop();
      return path?.startsWith('bitstream/') ? path : null;
    }
    if (!sourceUrl.includes('/handle/')) return null;

    try {
      const { response } = await fetchFollowingRedirects(sourceUrl, {
        headers: { Accept: 'text/html' },
        timeoutMs: 20_000,
      });
      if (!response.ok) {
        this.logger.warn(`Handle page fetch returned ${response.status} for ${sourceUrl}`);
        return null;
      }

      const html = await response.text();
      const candidates = [
        ...html.matchAll(/href="(\/bitstream\/[^"]+\.pdf[^"]*)"/gi),
        ...html.matchAll(/href='(\/bitstream\/[^']+\.pdf[^']*)'/gi),
        ...html.matchAll(/href="(https?:\/\/www\.indiacode\.nic\.in\/bitstream\/[^"]+\.pdf[^"]*)"/gi),
      ];

      for (const match of candidates) {
        const href = match[1];
        if (href.startsWith('http')) {
          const path = href.split('indiacode.nic.in/').pop();
          if (path?.startsWith('bitstream/')) return path;
        } else if (href.startsWith('/bitstream/')) {
          return href.slice(1);
        }
      }
    } catch (err) {
      this.logger.warn(`Handle page resolution failed for ${sourceUrl}`, err);
    }

    return null;
  }

  async fetchActMetadata(actId: string, externalId?: string): Promise<IndiaCodeActMeta | null> {
    if (!this.isEnabled()) return null;
    const sourceUrl = externalId ? this.resolveActUrl(externalId) : `${this.baseUrl}/handle/${actId}`;
    return {
      actId,
      title: actId,
      sourceUrl,
      externalId,
    };
  }

  async fetchActSections(
    externalId: string,
    options?: IndiaCodeFetchOptions,
  ): Promise<StatuteSectionFetchResult[]> {
    if (!this.isEnabled() || !externalId) {
      return [];
    }

    const sourceUrl = this.resolveActUrl(externalId);

    try {
      const pdfSections = await this.fetchFromPdf(sourceUrl, options);
      if (pdfSections.length > 0) {
        return pdfSections;
      }

      return await this.fetchFromHtml(sourceUrl, options);
    } catch (err) {
      this.logger.error(`India Code fetch failed for ${externalId}`, err);
      return [];
    }
  }

  resolvePrioritySections(
    actId: string,
    opts: { priorityOnly?: boolean } = {},
  ): readonly string[] | undefined {
    if (opts.priorityOnly && actId === 'income-tax') {
      return IN_INCOME_TAX_PRIORITY_SECTIONS;
    }
    return undefined;
  }

  private async fetchFromPdf(
    sourceUrl: string,
    options?: IndiaCodeFetchOptions,
  ): Promise<StatuteSectionFetchResult[]> {
    const { response, finalUrl } = await fetchFollowingRedirects(sourceUrl, {
      headers: { Accept: 'application/pdf,*/*' },
      timeoutMs: 30_000,
    });

    if (!response.ok) {
      this.logger.warn(`India Code PDF fetch returned ${response.status} for ${sourceUrl}`);
      return [];
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('pdf') && !sourceUrl.endsWith('.pdf') && !finalUrl.endsWith('.pdf')) {
      return [];
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buffer);
    const sections = parseActTextIntoSections(parsed.text ?? '', {
      prioritySections: options?.prioritySections,
    });

    return sections.map((section) => ({
      section: section.section,
      title: section.title,
      summary: truncateAtSentence(section.fullText, 400),
      fullText: section.fullText,
      sourceUrl: finalUrl,
      sourceName: 'India Code',
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    }));
  }

  private async fetchFromHtml(
    sourceUrl: string,
    options?: IndiaCodeFetchOptions,
  ): Promise<StatuteSectionFetchResult[]> {
    const { response } = await fetchFollowingRedirects(sourceUrl, {
      headers: { Accept: 'text/html' },
      timeoutMs: 20_000,
    });

    if (!response.ok) {
      this.logger.warn(`India Code HTML fetch returned ${response.status} for ${sourceUrl}`);
      return [];
    }

    const html = await response.text();
    const plainText = htmlToPlainText(html);
    const sections = parseActTextIntoSections(plainText, {
      prioritySections: options?.prioritySections,
    });

    return sections.map((section) => ({
      section: section.section,
      title: section.title,
      summary: truncateAtSentence(section.fullText, 400),
      fullText: section.fullText,
      sourceUrl,
      sourceName: 'India Code',
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    }));
  }
}
