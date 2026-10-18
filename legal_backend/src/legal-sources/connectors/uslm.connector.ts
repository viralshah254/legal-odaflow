import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fetchErrorCause, fetchTextWithRetry } from './http-fetch.util';
import { GovInfoUscConnector } from './govinfo-usc.connector';
import type { StatuteSectionFetchResult } from './us-code.connector';

/** Fetches U.S. Code sections from OLRC USLM XML (bulk per title). */
@Injectable()
export class UsLmConnector {
  private readonly logger = new Logger(UsLmConnector.name);
  private readonly cacheDir = resolve(process.cwd(), 'corpus/us/usc');
  private readonly releasePath =
    process.env.USLM_RELEASE_PATH ?? '119/99';
  private readonly mirrorHosts = (
    process.env.USLM_MIRROR_HOSTS ?? 'usc-cdn.house.gov,uscode.house.gov'
  )
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  constructor(private readonly govinfo: GovInfoUscConnector) {}

  isEnabled(): boolean {
    return true;
  }

  /** Parse all sections from a USC title number (1–54, skip 53). */
  async fetchTitleSections(
    titleNumber: number,
    opts: { maxSections?: number } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const govinfoSections = await this.govinfo.fetchTitleSections(titleNumber, opts);
    if (govinfoSections.length > 0) {
      return govinfoSections;
    }

    const xml = await this.loadTitleXml(titleNumber);
    if (!xml) return [];
    const sections = this.parseUsLmXml(xml, titleNumber);
    if (opts.maxSections && opts.maxSections > 0) {
      return sections.slice(0, opts.maxSections);
    }
    return sections;
  }

  /** Fetch a single section by title + section number (on-demand). */
  async fetchSection(
    titleNumber: number,
    sectionNumber: string,
  ): Promise<StatuteSectionFetchResult | null> {
    const normalized = this.normalizeSectionKey(sectionNumber);
    const cached = await this.fetchTitleSections(titleNumber);
    const match = cached.find(
      (s) => this.normalizeSectionKey(s.section) === normalized,
    );
    if (match) return match;

    const cornell = await this.fetchCornellSection(titleNumber, sectionNumber);
    return cornell;
  }

  private async loadTitleXml(titleNumber: number): Promise<string | null> {
    const cachePath = resolve(this.cacheDir, `title-${titleNumber}.xml`);
    if (existsSync(cachePath)) {
      const cached = readFileSync(cachePath, 'utf8');
      if (cached.includes('<mets ') || cached.includes('<mets>')) {
        this.logger.warn(`USLM title ${titleNumber}: ignoring invalid METS cache, use GovInfo zip`);
      } else {
        this.logger.log(`USLM title ${titleNumber} from local cache`);
        return cached;
      }
    }

    const errors: string[] = [];
    for (const url of this.buildDownloadUrls(titleNumber)) {
      try {
        const xml = await fetchTextWithRetry(url, {
          timeoutMs: 30_000,
          retries: 2,
        });
        if (!xml) {
          errors.push(`${url}: empty or invalid body`);
          continue;
        }
        mkdirSync(this.cacheDir, { recursive: true });
        writeFileSync(cachePath, xml, 'utf8');
        this.logger.log(`USLM title ${titleNumber} cached (${xml.length} bytes) from ${url}`);
        return xml;
      } catch (err) {
        errors.push(`${url}: ${fetchErrorCause(err)}`);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `USLM title ${titleNumber} unavailable (GovInfo + OLRC failed): ${errors.join('; ')}`,
      );
    }
    return null;
  }

  private buildDownloadUrls(titleNumber: number): string[] {
    const [congress, law] = this.releasePath.split('/');
    const rp = `us/pl/${congress}/${law}`;
    const paths = [
      `/download/releasepoints/${rp}/title_${titleNumber}/misa/misa_usc${titleNumber}.xml`,
      `/download/us/usc/t${titleNumber}/usc${titleNumber}.xml`,
    ];
    return this.mirrorHosts.flatMap((host) =>
      paths.map((path) => `https://${host}${path}`),
    );
  }

  parseUsLmXml(xml: string, titleNumber: number): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const seen = new Set<string>();
    const blockRe = /<section\b[^>]*>([\s\S]*?)<\/section>/gi;
    let block: RegExpExecArray | null;

    while ((block = blockRe.exec(xml)) !== null) {
      const chunk = block[0];
      const numMatch =
        chunk.match(/<num[^>]*value="([^"]+)"/i) ??
        chunk.match(/identifier="[^"]*\/s(\d+[a-zA-Z]*)/i);
      if (!numMatch) continue;

      const section = numMatch[1].replace(/^§\s*/, '').trim();
      const key = this.normalizeSectionKey(section);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const headingMatch = chunk.match(/<heading[^>]*>([\s\S]*?)<\/heading>/i);
      const heading = headingMatch
        ? this.stripXml(headingMatch[1]).trim()
        : `Section ${section}`;

      const contentMatch = chunk.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const body = contentMatch
        ? this.stripXml(contentMatch[1]).trim()
        : this.stripXml(chunk).trim();
      const fullText = body.length > 20 ? body : heading;
      const title = heading.startsWith('§') ? heading : `§ ${section}. ${heading}`;

      sections.push({
        section,
        title,
        summary: fullText.slice(0, 400),
        fullText,
        sourceUrl: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNumber}-section${section}`,
        sourceName: 'OLRC USLM',
      });
    }

    if (sections.length === 0) {
      return this.parseUsLmLegacyBlocks(xml, titleNumber);
    }
    return sections;
  }

  private parseUsLmLegacyBlocks(xml: string, titleNumber: number): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const re =
      /<num[^>]*value="(\d+[a-zA-Z]*)"[^>]*>[\s\S]*?<heading[^>]*>([\s\S]*?)<\/heading>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null && sections.length < 10_000) {
      const section = m[1];
      const heading = this.stripXml(m[2]).trim();
      const after = xml.slice(m.index, m.index + 4000);
      const contentMatch = after.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const body = contentMatch ? this.stripXml(contentMatch[1]).trim() : heading;
      sections.push({
        section,
        title: heading.startsWith('§') ? heading : `§ ${section}. ${heading}`,
        summary: body.slice(0, 400),
        fullText: body.length > 20 ? body : heading,
        sourceUrl: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNumber}-section${section}`,
        sourceName: 'OLRC USLM',
      });
    }
    return sections;
  }

  private async fetchCornellSection(
    titleNumber: number,
    sectionNumber: string,
  ): Promise<StatuteSectionFetchResult | null> {
    const paths = [
      `https://www.law.cornell.edu/uscode/text/${titleNumber}/section-${sectionNumber}`,
      `https://www.law.cornell.edu/uscode/text/${titleNumber}/chapter-1/section-${sectionNumber}`,
    ];
    for (const url of paths) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LegalByOdaflow/1.0)' },
        });
        if (!res.ok) continue;
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const pMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const body = pMatch ? this.stripXml(pMatch[1]).trim() : '';
        if (!body && !titleMatch) continue;
        return {
          section: sectionNumber,
          title: titleMatch?.[1]?.trim() ?? `§ ${sectionNumber}`,
          summary: (body.slice(0, 400) || titleMatch?.[1] || '').trim(),
          fullText: (body || titleMatch?.[1] || '').trim(),
          sourceUrl: url,
          sourceName: 'Cornell LII',
        };
      } catch {
        /* try next path */
      }
    }
    return null;
  }

  private stripXml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSectionKey(section: string): string {
    return section.toUpperCase().replace(/^0+(?=\d)/, '').replace(/\s+/g, '');
  }
}
