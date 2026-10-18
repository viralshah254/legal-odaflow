import { Injectable, Logger } from '@nestjs/common';
import { findUsStateManifestAct } from '../us-manifest.loader';
import {
  parseUsStateSectionHtml,
  parseUsStateSectionLinks,
  stripHtml,
} from '../parsers/us-state-section.parser';
import type { StatuteSectionFetchResult } from './us-code.connector';

export type UsStateSectionDepth = 'index' | 'full';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

/** Fetches US state code sections via manifest URLs (FindLaw / Cornell LII). */
@Injectable()
export class UsStateConnector {
  private readonly logger = new Logger(UsStateConnector.name);
  private readonly baseUrl = 'https://www.law.cornell.edu';

  async fetchActSections(
    stateCode: string,
    actId: string,
    opts: { maxSections?: number; sectionDepth?: UsStateSectionDepth; fullTextStates?: string[] } = {},
  ): Promise<StatuteSectionFetchResult[]> {
    const entry = findUsStateManifestAct(stateCode, actId);
    if (!entry?.primaryPdfUrl) return [];

    const url = entry.primaryPdfUrl.startsWith('http')
      ? entry.primaryPdfUrl
      : `${this.baseUrl}${entry.primaryPdfUrl}`;

    const depth = opts.sectionDepth ?? 'index';
    const pilotFull =
      depth === 'full' &&
      (opts.fullTextStates?.includes(stateCode.toUpperCase()) ?? false);

    try {
      const html = await this.fetchHtml(url, 30_000, stateCode, actId);
      if (!html) {
        this.logger.warn(`US state fetch failed for ${stateCode}/${actId}`);
        return [];
      }
      const cap = opts.maxSections ?? 50;

      if (pilotFull) {
        return this.fetchFullSectionText(html, url, entry.title, cap);
      }

      return this.parseSectionsFromHtml(html, url, entry.title, cap);
    } catch (err) {
      this.logger.error(`US state fetch failed for ${stateCode}/${actId}`, err);
      return [];
    }
  }

  async fetchSectionPageText(sectionUrl: string, section: string): Promise<string | undefined> {
    try {
      const html = await this.fetchHtml(sectionUrl, 20_000);
      if (!html) return undefined;
      return parseUsStateSectionHtml(html, section);
    } catch {
      return undefined;
    }
  }

  private async fetchHtml(
    url: string,
    timeoutMs = 30_000,
    stateCode = '',
    actId = '',
  ): Promise<string | undefined> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: BROWSER_HEADERS,
    });
    if (res.ok) return res.text();
    if (res.status === 403 && url.includes('findlaw.com')) {
      const fallback = this.findLawFallbackUrl(stateCode, actId, url);
      if (fallback) {
        const retry = await fetch(fallback, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: BROWSER_HEADERS,
        });
        if (retry.ok) return retry.text();
      }
    }
    this.logger.warn(`US state fetch ${res.status} for ${url}`);
    return undefined;
  }

  /** Best-effort alternate index when FindLaw blocks (403). */
  private findLawFallbackUrl(stateCode: string, actId: string, findLawUrl: string): string | undefined {
    const key = `${stateCode.toUpperCase()}/${actId}`;
    const explicit: Record<string, string> = {
      'TX/tx-penal-code': 'https://statutes.capitol.texas.gov/Docs/PE/htm/PE.htm',
      'NY/ny-penal-law': 'https://www.nysenate.gov/legislation/laws/PEN',
      'CA/ca-penal-code': 'https://leginfo.legislature.ca.gov/faces/codes.xhtml',
    };
    if (explicit[key]) return explicit[key];

    const m = findLawUrl.match(/codes\.findlaw\.com\/([a-z]{2})\/([^/]+)/i);
    if (!m) return undefined;
    const [, state, codeSlug] = m;
    const stateNames: Record<string, string> = {
      ca: 'california',
      ny: 'new_york',
      tx: 'texas',
      fl: 'florida',
      il: 'illinois',
    };
    const stateName = stateNames[state.toLowerCase()];
    if (!stateName) return undefined;
    return `${this.baseUrl}/regulations/${stateName.replace('_', '-')}`;
  }

  private async fetchFullSectionText(
    html: string,
    baseUrl: string,
    actTitle: string,
    cap: number,
  ): Promise<StatuteSectionFetchResult[]> {
    const links = parseUsStateSectionLinks(html, baseUrl);
    const indexFallback = this.parseSectionsFromHtml(html, baseUrl, actTitle, cap);
    const sourceLinks = links.length > 0 ? links.slice(0, cap) : indexFallback.map((s) => ({
      section: s.section,
      title: s.title.replace(`${actTitle} — `, ''),
      href: s.sourceUrl ?? baseUrl,
    }));

    const results: StatuteSectionFetchResult[] = [];
    for (const link of sourceLinks) {
      const fullText =
        (await this.fetchSectionPageText(link.href, link.section)) ??
        link.title;
      results.push({
        section: link.section,
        title: `${actTitle} — ${link.title}`,
        summary: link.title,
        fullText,
        sourceUrl: link.href,
        sourceName: 'FindLaw (state section)',
      });
      if (results.length >= cap && cap > 0) break;
    }
    return results;
  }

  private parseSectionsFromHtml(
    html: string,
    baseUrl: string,
    actTitle: string,
    cap = 50,
  ): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const seen = new Set<string>();

    const links = parseUsStateSectionLinks(html, baseUrl);
    for (const link of links) {
      if (cap > 0 && sections.length >= cap) break;
      const key = link.section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      sections.push({
        section: link.section,
        title: `${actTitle} — ${link.title}`,
        summary: link.title,
        fullText: link.title,
        sourceUrl: link.href,
        sourceName: 'State code index',
      });
    }

    const sectionLinkRe =
      /href="([^"]*(?:section|SEC)[^"]*(\d+(?:\.\d+)?[a-zA-Z]?)[^"]*)"[^>]*>([^<]{3,200})/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = sectionLinkRe.exec(html)) !== null && (cap <= 0 || sections.length < cap)) {
      const section = linkMatch[2];
      const key = section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const title = linkMatch[3].trim().replace(/\s+/g, ' ');
      const href = linkMatch[1].startsWith('http')
        ? linkMatch[1]
        : new URL(linkMatch[1], baseUrl).href;
      sections.push({
        section,
        title: `${actTitle} — ${title}`,
        summary: title,
        fullText: title,
        sourceUrl: href,
        sourceName: 'State code index',
      });
    }

    const sectionRegex = /§\s*(\d+(?:\.\d+)?[a-zA-Z]?)\s*[\.:]?\s*([^<]{5,200})/g;
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(html)) !== null && (cap <= 0 || sections.length < cap)) {
      const section = match[1];
      const key = section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const title = stripHtml(match[2]).trim();
      sections.push({
        section,
        title: `${actTitle} — ${title}`,
        summary: title,
        fullText: title,
        sourceUrl: baseUrl,
        sourceName: 'Cornell LII (state)',
      });
    }
    return sections;
  }
}
