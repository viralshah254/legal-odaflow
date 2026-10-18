import { Injectable, Logger } from '@nestjs/common';
import type { StatuteSectionFetchResult } from './us-code.connector';

/** Fetches Code of Federal Regulations via the official eCFR versioner API (full XML). */
@Injectable()
export class EcfRConnector {
  private readonly logger = new Logger(EcfRConnector.name);
  private readonly apiBase = 'https://www.ecfr.gov/api/versioner/v1';

  isEnabled(): boolean {
    return true;
  }

  /** Latest eCFR issue date used for bulk fetches (YYYY-MM-DD). */
  async getLatestIssueDate(): Promise<string> {
    try {
      const res = await fetch(`${this.apiBase}/titles.json`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return new Date().toISOString().slice(0, 10);
      const data = (await res.json()) as {
        titles?: Array<{ up_to_date_as_of?: string }>;
      };
      const dates = (data.titles ?? [])
        .map((t) => t.up_to_date_as_of)
        .filter(Boolean) as string[];
      if (dates.length === 0) return new Date().toISOString().slice(0, 10);
      return dates.sort().reverse()[0];
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  async fetchTitleSections(
    titleNumber: number,
    opts: { maxSections?: number; issueDate?: string } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const issueDate = opts.issueDate ?? await this.getLatestIssueDate();
    const bulkSections = await this.fetchFullTitleXml(titleNumber, issueDate);
    if (bulkSections.length > 0) {
      if (opts.maxSections && opts.maxSections > 0) {
        return bulkSections.slice(0, opts.maxSections);
      }
      return bulkSections;
    }
    return this.fetchTitleSectionsStructure(titleNumber, opts.maxSections ?? 0);
  }

  async fetchSection(
    titleNumber: number,
    sectionNumber: string,
    issueDate?: string,
  ): Promise<StatuteSectionFetchResult | null> {
    const sections = await this.fetchTitleSections(titleNumber, {
      issueDate,
      maxSections: 0,
    });
    const key = sectionNumber.replace(/^0+(?=\d)/, '').toUpperCase();
    return sections.find(
      (s) => s.section.replace(/^0+(?=\d)/, '').toUpperCase() === key,
    ) ?? null;
  }

  private async fetchFullTitleXml(
    titleNumber: number,
    issueDate: string,
  ): Promise<StatuteSectionFetchResult[]> {
    const url = `${this.apiBase}/full/${issueDate}/title-${titleNumber}.xml`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) {
        this.logger.warn(`eCFR full XML ${res.status} for title ${titleNumber}`);
        return [];
      }
      const xml = await res.text();
      return this.parseEcfrXml(xml, titleNumber);
    } catch (err) {
      this.logger.error(`eCFR full XML fetch failed for title ${titleNumber}`, err);
      return [];
    }
  }

  parseEcfrXml(xml: string, titleNumber: number): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const seen = new Set<string>();
    const blockRe = /<DIV8\s+N="([^"]+)"\s+TYPE="SECTION"[^>]*>([\s\S]*?)<\/DIV8>/gi;
    let m: RegExpExecArray | null;

    while ((m = blockRe.exec(xml)) !== null) {
      const section = m[1];
      const chunk = m[2];
      const key = section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const headMatch = chunk.match(/<HEAD>([\s\S]*?)<\/HEAD>/i);
      const heading = headMatch ? this.stripXml(headMatch[1]).trim() : `§ ${section}`;
      const paragraphs = [...chunk.matchAll(/<P[^>]*>([\s\S]*?)<\/P>/gi)]
        .map((pm) => this.stripXml(pm[1]).trim())
        .filter((t) => t.length > 0);
      const fullText = paragraphs.join('\n\n') || heading;

      sections.push({
        section,
        title: heading,
        summary: fullText.slice(0, 400),
        fullText,
        sourceUrl: `https://www.ecfr.gov/current/title-${titleNumber}/section-${section}`,
        sourceName: 'eCFR',
      });
    }
    return sections;
  }

  private async fetchTitleSectionsStructure(
    titleNumber: number,
    maxSections: number,
  ): Promise<StatuteSectionFetchResult[]> {
    try {
      const issueDate = await this.getLatestIssueDate();
      const structureUrl = `${this.apiBase}/structure/${issueDate}/title-${titleNumber}.json`;
      const res = await fetch(structureUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        return this.fetchTitleSectionsFallback(titleNumber, maxSections || 50);
      }
      const data = (await res.json()) as { children?: Array<{ identifier?: string; label?: string }> };
      const sections: StatuteSectionFetchResult[] = [];
      const cap = maxSections > 0 ? maxSections : 10_000;
      const walk = (nodes: Array<{ identifier?: string; label?: string; children?: unknown[] }>) => {
        for (const node of nodes) {
          if (node.identifier && /^\d+/.test(node.identifier) && sections.length < cap) {
            const label = node.label ?? node.identifier;
            sections.push({
              section: node.identifier,
              title: label,
              summary: label,
              fullText: label,
              sourceUrl: `https://www.ecfr.gov/current/title-${titleNumber}/section-${node.identifier}`,
              sourceName: 'eCFR',
            });
          }
          if (node.children && Array.isArray(node.children)) {
            walk(node.children as Array<{ identifier?: string; label?: string; children?: unknown[] }>);
          }
        }
      };
      if (data.children) {
        walk(data.children as Array<{ identifier?: string; label?: string; children?: unknown[] }>);
      }
      return sections;
    } catch (err) {
      this.logger.error(`eCFR structure fetch failed for title ${titleNumber}`, err);
      return this.fetchTitleSectionsFallback(titleNumber, maxSections || 50);
    }
  }

  private async fetchTitleSectionsFallback(
    titleNumber: number,
    maxSections: number,
  ): Promise<StatuteSectionFetchResult[]> {
    const url = `https://www.law.cornell.edu/cfr/text/${titleNumber}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return [];
      const html = await res.text();
      const sections: StatuteSectionFetchResult[] = [];
      const re = /§\s*(\d+(?:\.\d+)?)\s*([^<]{5,120})/g;
      let m: RegExpExecArray | null;
      const cap = maxSections > 0 ? maxSections : 10_000;
      while ((m = re.exec(html)) !== null && sections.length < cap) {
        sections.push({
          section: m[1],
          title: m[2].trim(),
          summary: m[2].trim(),
          fullText: m[2].trim(),
          sourceUrl: `${url}/section-${m[1]}`,
          sourceName: 'Cornell LII (CFR)',
        });
      }
      return sections;
    } catch {
      return [];
    }
  }

  async fetchActSections(
    externalId: string,
    opts: { maxSections?: number } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const match = externalId.match(/^cfr-(\d+)$/i);
    if (!match) return [];
    return this.fetchTitleSections(parseInt(match[1], 10), opts);
  }

  private stripXml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
