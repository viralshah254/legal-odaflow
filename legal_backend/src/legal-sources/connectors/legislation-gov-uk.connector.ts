import { Injectable, Logger } from '@nestjs/common';
import type { StatuteSectionFetchResult } from './us-code.connector';

/** Fetches UK legislation via legislation.gov.uk REST API. */
@Injectable()
export class LegislationGovUkConnector {
  private readonly logger = new Logger(LegislationGovUkConnector.name);
  private readonly baseUrl = 'https://www.legislation.gov.uk';

  async fetchActSections(externalId: string): Promise<StatuteSectionFetchResult[]> {
    const path = this.resolveLegislationPath(externalId);
    if (!path) return [];

    try {
      const res = await fetch(`${this.baseUrl}/${path}/data.xml`, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'application/xml' },
      });
      if (!res.ok) {
        this.logger.warn(`legislation.gov.uk returned ${res.status} for ${externalId}`);
        return this.fetchFromHtml(path);
      }
      const xml = await res.text();
      return this.parseXmlSections(xml, `${this.baseUrl}/${path}`);
    } catch (err) {
      this.logger.error(`legislation.gov.uk fetch failed for ${externalId}`, err);
      return [];
    }
  }

  private resolveLegislationPath(externalId: string): string | null {
    // e.g. ukpga-1996-18 → ukpga/1996/18
    const match = externalId.match(/^([a-z]+)-(\d{4})-(\d+)$/i);
    if (!match) return null;
    return `${match[1]}/${match[2]}/${match[3]}`;
  }

  private parseXmlSections(xml: string, baseUrl: string): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const blockRegex =
      /<Section[^>]*>[\s\S]*?<Number>([^<]+)<\/Number>[\s\S]*?(?:<Title[^>]*>([^<]*)<\/Title>)?[\s\S]*?(?:<P[^>]*>([^<]{20,800})<\/P>)?/gi;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(xml)) !== null && sections.length < 60) {
      const section = match[1].trim();
      const title = (match[2] ?? `Section ${section}`).trim();
      const paragraph = (match[3] ?? title).trim();
      sections.push({
        section,
        title,
        summary: paragraph.slice(0, 400),
        fullText: paragraph,
        sourceUrl: `${baseUrl}/section/${section}`,
      });
    }
    return sections;
  }

  private async fetchFromHtml(path: string): Promise<StatuteSectionFetchResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/${path}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return [];
      const html = await res.text();
      const sections: StatuteSectionFetchResult[] = [];
      const re = /section-(\d+)[^"']*"[^>]*>([^<]{5,200})/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(html)) !== null && sections.length < 40) {
        sections.push({
          section: match[1],
          title: match[2].trim(),
          summary: match[2].trim(),
          fullText: match[2].trim(),
          sourceUrl: `${this.baseUrl}/${path}/section/${match[1]}`,
        });
      }
      return sections;
    } catch {
      return [];
    }
  }
}
