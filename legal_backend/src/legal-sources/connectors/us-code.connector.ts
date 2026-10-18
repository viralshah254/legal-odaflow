import { Injectable, Logger } from '@nestjs/common';

export interface StatuteSectionFetchResult {
  section: string;
  title: string;
  summary: string;
  fullText: string;
  sourceUrl?: string;
  sourceName?: string;
  contentHash?: string;
  isRepealed?: boolean;
  repealNotes?: string;
}

/** Fetches U.S. Code sections via Cornell LII (JSON + HTML). */
@Injectable()
export class UsCodeConnector {
  private readonly logger = new Logger(UsCodeConnector.name);
  private readonly baseUrl = 'https://www.law.cornell.edu/uscode/text';
  private readonly rulesBase = 'https://www.law.cornell.edu/rules';

  async fetchActSections(
    externalId: string,
    opts: { maxSections?: number } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const cap = opts.maxSections ?? 50;
    if (externalId.startsWith('rules-')) {
      return this.fetchRules(externalId, cap);
    }
    if (externalId.startsWith('ucc-')) {
      return this.fetchUcc(externalId, cap);
    }

    const path = this.resolvePath(externalId);
    if (!path) return [];

    const jsonSections = await this.fetchJsonSections(path, cap);
    if (jsonSections.length > 0) return jsonSections;

    try {
      const res = await fetch(`${this.baseUrl}/${path}`, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; LegalByOdaflow/1.0)',
        },
      });
      if (!res.ok) {
        this.logger.warn(`US Code fetch returned ${res.status} for ${externalId}`);
        return [];
      }
      const html = await res.text();
      return this.parseSectionsFromHtml(html, `${this.baseUrl}/${path}`, '§', cap);
    } catch (err) {
      this.logger.error(`US Code fetch failed for ${externalId}`, err);
      return [];
    }
  }

  private async fetchJsonSections(path: string, cap = 50): Promise<StatuteSectionFetchResult[]> {
    const url = `${this.baseUrl}/${path}.json`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        sections?: Array<{ section?: string; title?: string; content?: string }>;
        title?: string;
        content?: string;
      };
      if (data.sections?.length) {
        return data.sections.slice(0, cap).map((s) => ({
          section: s.section ?? '0',
          title: s.title ?? s.section ?? 'Section',
          summary: (s.content ?? s.title ?? '').slice(0, 400),
          fullText: s.content ?? s.title ?? '',
          sourceUrl: `${this.baseUrl}/${path}/${s.section ?? ''}`,
          sourceName: 'Cornell LII',
        }));
      }
      if (data.content) {
        return [{
          section: path.split('/').pop() ?? '0',
          title: data.title ?? path,
          summary: data.content.slice(0, 400),
          fullText: data.content,
          sourceUrl: `${this.baseUrl}/${path}`,
          sourceName: 'Cornell LII',
        }];
      }
      return [];
    } catch {
      return [];
    }
  }

  private async fetchRules(externalId: string, cap = 50): Promise<StatuteSectionFetchResult[]> {
    const ruleMap: Record<string, string> = {
      'rules-frcp': `${this.rulesBase}/frcp`,
      'rules-frcrp': `${this.rulesBase}/frcrmp`,
    };
    const url = ruleMap[externalId];
    if (!url) return [];
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return [];
      const html = await res.text();
      return this.parseSectionsFromHtml(html, url, 'Rule', cap);
    } catch {
      return [];
    }
  }

  private async fetchUcc(externalId: string, cap = 50): Promise<StatuteSectionFetchResult[]> {
    const article = externalId.replace('ucc-', '') || '1';
    const url = `https://www.law.cornell.edu/ucc/${article}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return [];
      const html = await res.text();
      return this.parseSectionsFromHtml(html, url, 'UCC', cap);
    } catch {
      return [];
    }
  }

  private resolvePath(externalId: string): string | null {
    if (externalId.startsWith('usc-')) {
      const parts = externalId.replace('usc-', '').split('-');
      if (parts.length === 1) return parts[0];
      return parts.join('/');
    }
    return null;
  }

  private parseSectionsFromHtml(
    html: string,
    baseUrl: string,
    prefix = '§',
    cap = 50,
  ): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const sectionRegex = /§\s*(\d+(?:\.\d+)?[a-zA-Z]?)\s*[\.:]?\s*([^<]{5,200})/g;
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(html)) !== null && sections.length < cap) {
      const section = match[1];
      const title = match[2].trim().replace(/\s+/g, ' ');
      sections.push({
        section,
        title: `${prefix} ${section} — ${title}`,
        summary: title,
        fullText: title,
        sourceUrl: `${baseUrl}/${section}`,
        sourceName: 'Cornell LII',
      });
    }
    return sections;
  }
}
