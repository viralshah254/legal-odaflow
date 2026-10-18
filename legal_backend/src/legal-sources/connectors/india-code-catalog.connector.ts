import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchFollowingRedirects } from './india-pdf.util';
import { IndiaCodeConnector } from './india-code.connector';

export interface IndiaCatalogAct {
  actId: string;
  title: string;
  primaryPdfUrl: string;
  externalId?: string;
  year?: number;
}

const CENTRAL_BROWSE_PATH =
  '/handle/123456789/1362/browse?type=shorttitle&sort_by=1&order=ASC&rpp=100&etal=-1&null=';
const BROWSE_ROW_RE =
  /<tr[^>]*>[\s\S]*?headers="t3"[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?href="(\/handle\/123456789\/\d+\?view_type=browse)"[\s\S]*?<\/tr>/gi;
const BITSTREAM_HREF_RE =
  /href="(\/bitstream\/123456789\/[^"]+\.pdf[^"]*)"/i;
const CITATION_PDF_RE =
  /<meta\s+name="citation_pdf_url"\s+content="([^"]+)"/i;

@Injectable()
export class IndiaCodeCatalogConnector {
  private readonly logger = new Logger(IndiaCodeCatalogConnector.name);
  private readonly baseUrl = 'https://www.indiacode.nic.in';

  constructor(
    private readonly configService: ConfigService,
    private readonly indiaCode: IndiaCodeConnector,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_INDIA_CODE_CATALOG', 'true') === 'true';
  }

  /** Crawl India Code central-acts browse pages and return discovered acts. */
  async discoverActs(
    opts: { maxPages?: number; resolveBitstreams?: boolean } = {},
  ): Promise<IndiaCatalogAct[]> {
    if (!this.isEnabled()) return [];

    const maxPages = opts.maxPages ?? 500;
    const acts: IndiaCatalogAct[] = [];
    const seenHandles = new Set<string>();

    for (let page = 0; page < maxPages; page++) {
      const offset = page * 100;
      const browseUrl = `${this.baseUrl}${CENTRAL_BROWSE_PATH}&offset=${offset}`;
      const html = await this.fetchHtml(browseUrl);
      if (!html) break;

      const pageActs = this.parseBrowseRows(html);
      if (pageActs.length === 0) break;

      let newOnPage = 0;
      for (const row of pageActs) {
        if (seenHandles.has(row.handleId)) continue;
        seenHandles.add(row.handleId);
        newOnPage += 1;

        let primaryPdfUrl = row.handleUrl;
        let externalId: string | undefined;

        if (opts.resolveBitstreams !== false) {
          const resolved = await this.resolvePrimaryPdf(row.handleUrl);
          if (resolved) {
            primaryPdfUrl = resolved.primaryPdfUrl;
            externalId = resolved.externalId;
          }
        }

        acts.push({
          actId: this.slugifyActId(row.title, row.handleId),
          title: row.title,
          primaryPdfUrl,
          externalId,
          year: this.extractYear(row.title),
        });
      }

      if (newOnPage === 0 || !html.includes(`offset=${offset + 100}`)) {
        break;
      }
    }

    this.logger.log(`Discovered ${acts.length} central acts from India Code browse`);
    return acts;
  }

  /** Search India Code by title (discovery fallback). */
  async searchByTitle(query: string, limit = 20): Promise<IndiaCatalogAct[]> {
    if (!this.isEnabled() || !query.trim()) return [];

    const searchUrl = `${this.baseUrl}/simple-search?query=${encodeURIComponent(query.trim())}&submit=Go`;
    const html = await this.fetchHtml(searchUrl);
    if (!html) return [];

    const results: IndiaCatalogAct[] = [];
    const handleRe =
      /href="(\/handle\/123456789\/\d+\?view_type=browse)"[^>]*>View\.\.\.<\/a>[\s\S]{0,400}?<strong>([^<]+)<\/strong>/gi;
    let match: RegExpExecArray | null;

    while ((match = handleRe.exec(html)) !== null && results.length < limit) {
      const handlePath = match[1];
      const title = this.decodeHtmlEntities(match[2].trim());
      const handleId = this.extractHandleId(handlePath);
      if (!handleId) continue;

      const handleUrl = `${this.baseUrl}${handlePath.replace('?view_type=browse', '')}`;
      const resolved = await this.resolvePrimaryPdf(`${this.baseUrl}${handlePath}`);
      results.push({
        actId: this.slugifyActId(title, handleId),
        title,
        primaryPdfUrl: resolved?.primaryPdfUrl ?? handleUrl,
        externalId: resolved?.externalId,
        year: this.extractYear(title),
      });
    }

    if (results.length === 0) {
      for (const row of this.parseBrowseRows(html)) {
        if (results.length >= limit) break;
        if (!row.title.toLowerCase().includes(query.trim().toLowerCase())) continue;
        const resolved = await this.resolvePrimaryPdf(row.handleUrl);
        results.push({
          actId: this.slugifyActId(row.title, row.handleId),
          title: row.title,
          primaryPdfUrl: resolved?.primaryPdfUrl ?? row.handleUrl,
          externalId: resolved?.externalId,
          year: this.extractYear(row.title),
        });
      }
    }

    return results;
  }

  private parseBrowseRows(html: string): Array<{ title: string; handleId: string; handleUrl: string }> {
    const rows: Array<{ title: string; handleId: string; handleUrl: string }> = [];
    let match: RegExpExecArray | null;
    BROWSE_ROW_RE.lastIndex = 0;

    while ((match = BROWSE_ROW_RE.exec(html)) !== null) {
      const title = this.decodeHtmlEntities(match[1].trim());
      const handlePath = match[2];
      const handleId = this.extractHandleId(handlePath);
      if (!handleId || !title) continue;
      rows.push({
        title,
        handleId,
        handleUrl: `${this.baseUrl}${handlePath.replace('?view_type=browse', '')}`,
      });
    }

    return rows;
  }

  private async resolvePrimaryPdf(
    browseViewUrl: string,
  ): Promise<{ primaryPdfUrl: string; externalId: string } | null> {
    const viewUrl = browseViewUrl.includes('view_type=browse')
      ? browseViewUrl
      : `${browseViewUrl}?view_type=browse`;

    const html = await this.fetchHtml(viewUrl);
    if (html) {
      const citationMatch = html.match(CITATION_PDF_RE);
      if (citationMatch?.[1]) {
        const pdfUrl = citationMatch[1].replace(/^http:\/\//i, 'https://');
        const externalId = (await this.indiaCode.resolveBitstreamExternalId(pdfUrl)) ?? undefined;
        if (externalId) {
          return { primaryPdfUrl: pdfUrl, externalId };
        }
      }

      const bitstreamMatch = html.match(BITSTREAM_HREF_RE);
      if (bitstreamMatch?.[1]) {
        const primaryPdfUrl = `${this.baseUrl}${bitstreamMatch[1]}`;
        const externalId =
          (await this.indiaCode.resolveBitstreamExternalId(primaryPdfUrl)) ?? undefined;
        if (externalId) {
          return { primaryPdfUrl, externalId };
        }
      }
    }

    const handleUrl = viewUrl.replace(/\?view_type=browse$/, '');
    const externalId = await this.indiaCode.resolveBitstreamExternalId(handleUrl);
    if (!externalId) return null;

    return {
      primaryPdfUrl: this.indiaCode.resolveActUrl(externalId),
      externalId,
    };
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const { response } = await fetchFollowingRedirects(url, {
        headers: { Accept: 'text/html' },
        timeoutMs: 25_000,
      });
      if (!response.ok) {
        this.logger.warn(`India Code catalog fetch returned ${response.status} for ${url}`);
        return null;
      }
      return await response.text();
    } catch (err) {
      this.logger.warn(`India Code catalog fetch failed for ${url}`, err);
      return null;
    }
  }

  private extractHandleId(path: string): string | null {
    const match = path.match(/\/handle\/123456789\/(\d+)/);
    return match?.[1] ?? null;
  }

  private extractYear(title: string): number | undefined {
    const match = title.match(/\b(1[89]\d{2}|20\d{2})\b/);
    return match ? Number(match[1]) : undefined;
  }

  private slugifyActId(title: string, handleId: string): string {
    const base = title
      .replace(/^The\s+/i, '')
      .replace(/,?\s*(1[89]\d{2}|20\d{2})\s*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
    return base || `india-code-${handleId}`;
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&#x20;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
