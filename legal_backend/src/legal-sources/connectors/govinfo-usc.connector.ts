import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { StatuteSectionFetchResult } from './us-code.connector';
import { fetchBufferWithRetry, fetchErrorCause, fetchWithRetry } from './http-fetch.util';

interface GovInfoPackageSummary {
  packageId?: string;
  titleNumber?: string;
  lastModified?: string;
  download?: { zipLink?: string };
}

/** Fetches U.S. Code via GovInfo API (GPO packages with per-section HTML). */
@Injectable()
export class GovInfoUscConnector {
  private readonly logger = new Logger(GovInfoUscConnector.name);
  private readonly apiBase = 'https://api.govinfo.gov';
  private readonly cacheDir = resolve(process.cwd(), 'corpus/us/usc');
  private readonly edition = process.env.GOVINFO_USCODE_EDITION ?? '2024';

  getApiKey(): string {
    return process.env.GOVINFO_API_KEY?.trim() || 'DEMO_KEY';
  }

  packageIdForTitle(titleNumber: number): string {
    return `USCODE-${this.edition}-title${titleNumber}`;
  }

  zipCachePath(titleNumber: number): string {
    return resolve(this.cacheDir, `title-${titleNumber}.govinfo.zip`);
  }

  /** Probe GovInfo API reachability (cheap summary request). */
  async probe(): Promise<boolean> {
    try {
      const url = `${this.apiBase}/packages/${this.packageIdForTitle(18)}/summary?api_key=${this.getApiKey()}`;
      const res = await fetchWithRetry(url, { timeoutMs: 15_000, retries: 2 });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Fetch all sections for a USC title from GovInfo package zip (HTML granules). */
  async fetchTitleSections(
    titleNumber: number,
    opts: { maxSections?: number; force?: boolean } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const zipBuf = await this.loadTitleZip(titleNumber, opts.force);
    if (!zipBuf) return [];

    const sections = this.parseSectionsFromZip(zipBuf, titleNumber);
    if (opts.maxSections && opts.maxSections > 0) {
      return sections.slice(0, opts.maxSections);
    }
    return sections;
  }

  /** @deprecated Use fetchTitleSections; kept for prefetch zip caching. */
  async fetchTitleXml(titleNumber: number, opts: { force?: boolean } = {}): Promise<string | null> {
    const zipBuf = await this.loadTitleZip(titleNumber, opts.force);
    return zipBuf ? 'cached' : null;
  }

  private async loadTitleZip(titleNumber: number, force = false): Promise<Buffer | null> {
    const cachePath = this.zipCachePath(titleNumber);
    if (!force && existsSync(cachePath)) {
      this.logger.log(`GovInfo title ${titleNumber} zip from local cache`);
      return readFileSync(cachePath);
    }

    const packageId = this.packageIdForTitle(titleNumber);
    const summaryUrl = `${this.apiBase}/packages/${packageId}/summary?api_key=${this.getApiKey()}`;

    let summary: GovInfoPackageSummary;
    try {
      const res = await fetchWithRetry(summaryUrl, { timeoutMs: 30_000, retries: 3 });
      if (!res.ok) {
        this.logger.warn(`GovInfo summary ${res.status} for ${packageId}`);
        return null;
      }
      summary = (await res.json()) as GovInfoPackageSummary;
    } catch (err) {
      this.logger.warn(`GovInfo summary failed for title ${titleNumber}: ${fetchErrorCause(err)}`);
      return null;
    }

    const zipUrl = summary.download?.zipLink
      ? `${summary.download.zipLink}?api_key=${this.getApiKey()}`
      : `${this.apiBase}/packages/${packageId}/zip?api_key=${this.getApiKey()}`;

    this.logger.log(`GovInfo downloading ${packageId} (edition ${this.edition})…`);
    const zipBuf = await fetchBufferWithRetry(zipUrl, {
      timeoutMs: titleNumber === 42 ? 2_400_000 : 1_200_000,
      retries: titleNumber === 42 ? 5 : 4,
      minBytes: 10_000,
      validateXml: false,
    });
    if (!zipBuf) {
      this.logger.warn(`GovInfo zip download failed for title ${titleNumber}`);
      return null;
    }

    mkdirSync(this.cacheDir, { recursive: true });
    writeFileSync(cachePath, zipBuf);
    this.logger.log(`GovInfo title ${titleNumber} zip cached (${zipBuf.length} bytes)`);
    return zipBuf;
  }

  parseSectionsFromZip(zipBuf: Buffer, titleNumber: number): StatuteSectionFetchResult[] {
    const zip = new AdmZip(zipBuf);
    const sections: StatuteSectionFetchResult[] = [];
    const seen = new Set<string>();

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, '/');
      const secMatch = name.match(/-sec([\d]+[a-zA-Z]?)\.htm$/i);
      if (!secMatch) continue;

      const section = secMatch[1];
      const key = section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const html = entry.getData().toString('utf8');
      const parsed = this.parseSectionHtml(html, section, titleNumber, name);
      if (parsed) sections.push(parsed);
    }

    sections.sort((a, b) => this.sectionSortKey(a.section).localeCompare(this.sectionSortKey(b.section)));
    return sections;
  }

  private parseSectionHtml(
    html: string,
    section: string,
    titleNumber: number,
    entryName: string,
  ): StatuteSectionFetchResult | null {
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const headingRaw = h3Match ? this.stripHtml(h3Match[1]) : '';
    const heading = headingRaw || `§ ${section}`;

    const bodyStart = h3Match
      ? html.indexOf(h3Match[0]) + h3Match[0].length
      : 0;
    const body = this.stripHtml(html.slice(bodyStart)).trim();
    const fullText = body.length > 20 ? body : heading;
    if (!fullText || fullText.length < 5) return null;

    const granuleId = entryName
      .replace(/^.*\/html\//i, '')
      .replace(/\.htm$/i, '');
    const packageId = this.packageIdForTitle(titleNumber);

    return {
      section,
      title: heading.startsWith('§') ? heading : `§ ${section}. ${heading.replace(/^§\s*\d+[a-zA-Z]?\.?\s*/i, '').trim() || heading}`,
      summary: fullText.slice(0, 400),
      fullText,
      sourceUrl: `https://www.govinfo.gov/app/details/${packageId}/${granuleId}`,
      sourceName: 'GovInfo USCODE',
    };
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sectionSortKey(section: string): string {
    const m = section.match(/^(\d+)([a-zA-Z]?)$/);
    if (!m) return section;
    return `${m[1].padStart(6, '0')}${m[2].toLowerCase()}`;
  }
}
