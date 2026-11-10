import { researchRequestSignal, assertResearchBudgetActive } from '@/common/utils/research-execution-budget';
import { parseDocument, DomUtils } from 'htmlparser2';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
import type { StatuteSectionFetchResult } from './us-code.connector';
import { fetchPdfBuffer, extractPdfText } from './india-pdf.util';
import { parseKenyaActPdfText } from '../parsers/kenya-act-pdf-text.parser';
import {
  kenyaLawFetchHeaders,
  kenyaLawRateLimit,
  isKenyaLawRetryableStatus,
  kenyaLawThrottleBackoff,
} from './kenya-law-rate-limit';

const execFileAsync = promisify(execFile);

export interface KenyaLawActDocument {
  originalContent: string;
  mediaType: 'text/html' | 'application/pdf';
  sections: StatuteSectionFetchResult[];
  complete: boolean;
  extractionMethod?: 'HTML' | 'PDF_TEXT' | 'OCR';
}

const PDF_TEXT_FLOOR = 200;
/** Azure Document Intelligence rejects very large scan PDFs; rasterize+OCR pages instead. */
const PDF_OCR_DIRECT_MAX_BYTES = 4 * 1024 * 1024;

/** Build Kenya Law source.pdf URL from an expression public URL. */
export function kenyaLawSourcePdfUrl(publicUrl: string): string {
  return `${publicUrl.replace(/\/+$/, '')}/source.pdf`;
}

/** Fetches Kenya Law (Akoma Ntoso) act sections from the public website. */
@Injectable()
export class KenyaLawConnector {
  private readonly logger = new Logger(KenyaLawConnector.name);
  /** Large consolidated acts (e.g. EMCA ~730KB) need more than the old 45s cap. */
  private static readonly TIMEOUT_MS = 120_000;
  private static readonly PDF_TIMEOUT_MS = 120_000;

  constructor(@Optional() private readonly azureOcr?: AzureOcrService) {}

  async fetchActSections(sourceUrl: string): Promise<StatuteSectionFetchResult[]> {
    return (await this.fetchActDocument(sourceUrl))?.sections ?? [];
  }

  async fetchActDocument(sourceUrl: string): Promise<KenyaLawActDocument | null> {
    let allowed = false;
    try { const url = new URL(sourceUrl); allowed = url.protocol === 'https:' && ['kenyalaw.org', 'www.kenyalaw.org', 'new.kenyalaw.org'].includes(url.hostname) && !url.username && !url.password; } catch {}
    if (!allowed) {
      return null;
    }

    const body = await this.fetchHtml(sourceUrl);
    if (!body) return null;

    const aknSections = parseKenyaLawAknHtmlSections(body, sourceUrl);
    if (aknSections.length > 0) {
      return {
        originalContent: body,
        mediaType: 'text/html',
        sections: aknSections,
        complete: true,
        extractionMethod: 'HTML',
      };
    }

    return {
      originalContent: body,
      mediaType: 'text/html',
      sections: this.parseLegacyRegexSections(body, sourceUrl),
      complete: false,
      extractionMethod: 'HTML',
    };
  }

  /**
   * Fetch Kenya Law expression source.pdf, extract text (pdf-parse, Azure OCR if empty),
   * and split into sections.
   */
  async fetchActDocumentFromSourcePdf(
    publicUrl: string,
  ): Promise<KenyaLawActDocument | null> {
    if (!publicUrl.includes('kenyalaw.org')) {
      return null;
    }

    const pdfUrl = kenyaLawSourcePdfUrl(publicUrl);
    try {
      await kenyaLawRateLimit();
      const { buffer } = await fetchPdfBuffer(pdfUrl, KenyaLawConnector.PDF_TIMEOUT_MS);
      let text = (await extractPdfText(buffer)).trim();
      let extractionMethod: 'PDF_TEXT' | 'OCR' = 'PDF_TEXT';

      if (text.length < PDF_TEXT_FLOOR && this.azureOcr) {
        this.logger.warn(
          `Kenya Law source.pdf text short (${text.length} chars) for ${pdfUrl}; trying Azure OCR`,
        );
        const ocrText = await this.ocrSourcePdfBuffer(buffer, pdfUrl);
        if (ocrText.length > text.length) {
          text = ocrText;
          extractionMethod = 'OCR';
        }
      }

      if (text.length < 8) {
        this.logger.warn(`Kenya Law source.pdf yielded no text for ${pdfUrl}`);
        return null;
      }

      const parsed = parseKenyaActPdfText(text, pdfUrl);
      if (parsed.sections.length === 0) {
        return null;
      }

      return {
        originalContent: text,
        mediaType: 'application/pdf',
        sections: parsed.sections,
        complete: parsed.complete,
        extractionMethod,
      };
    } catch (err) {
      this.logger.warn(
        `Kenya Law source.pdf fetch failed for ${pdfUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async ocrSourcePdfBuffer(buffer: Buffer, pdfUrl: string): Promise<string> {
    if (!this.azureOcr) return '';

    if (buffer.length <= PDF_OCR_DIRECT_MAX_BYTES) {
      try {
        return (await this.azureOcr.extractTextFromBuffer(buffer, 'application/pdf')).trim();
      } catch (err) {
        this.logger.warn(
          `Kenya Law source.pdf direct OCR failed for ${pdfUrl}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    } else {
      this.logger.warn(
        `Kenya Law source.pdf too large for direct OCR (${buffer.length} bytes); trying page rasters`,
      );
    }

    return this.ocrPdfViaPageRasters(buffer, pdfUrl);
  }

  /**
   * Rasterize PDF pages with pdftoppm (Poppler) and OCR each page.
   * Used for scanned Kenya Law source.pdf files that exceed Azure's direct size limit.
   */
  private async ocrPdfViaPageRasters(buffer: Buffer, pdfUrl: string): Promise<string> {
    if (!this.azureOcr) return '';

    const dir = mkdtempSync(join(tmpdir(), 'ke-pdf-ocr-'));
    const pdfPath = join(dir, 'source.pdf');
    try {
      writeFileSync(pdfPath, buffer);
      await execFileAsync(
        'pdftoppm',
        ['-png', '-r', '120', pdfPath, join(dir, 'page')],
        { timeout: 300_000 },
      );
      const pages = readdirSync(dir)
        .filter((name) => name.startsWith('page-') && name.endsWith('.png'))
        .sort();
      if (pages.length === 0) {
        this.logger.warn(`pdftoppm produced no pages for ${pdfUrl}`);
        return '';
      }

      const chunks: string[] = [];
      const concurrency = 3;
      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        const texts = await Promise.all(
          batch.map(async (name) => {
            const png = readFileSync(join(dir, name));
            try {
              return (await this.azureOcr!.extractTextFromBuffer(png, 'image/png')).trim();
            } catch (err) {
              this.logger.warn(
                `OCR failed for ${name} of ${pdfUrl}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
              return '';
            }
          }),
        );
        chunks.push(...texts.filter(Boolean));
        if ((i + concurrency) % 15 === 0 || i + concurrency >= pages.length) {
          this.logger.log(
            `Kenya Law page OCR ${Math.min(i + concurrency, pages.length)}/${pages.length} for ${pdfUrl}`,
          );
        }
      }
      return chunks.join('\n\n').trim();
    } catch (err) {
      this.logger.warn(
        `Kenya Law page-raster OCR unavailable for ${pdfUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return '';
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  private async fetchHtml(sourceUrl: string): Promise<string | null> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assertResearchBudgetActive();
      try {
        await kenyaLawRateLimit();
        const res = await fetch(sourceUrl, {
          signal: researchRequestSignal(KenyaLawConnector.TIMEOUT_MS),
          headers: kenyaLawFetchHeaders(),
        });
        if (isKenyaLawRetryableStatus(res.status) && attempt < 3) {
          this.logger.warn(
            `Kenya Law throttled (${res.status}) for ${sourceUrl}, retry ${attempt}/3`,
          );
          await kenyaLawThrottleBackoff(res.status, attempt);
          continue;
        }
        if (!res.ok) {
          this.logger.warn(`Kenya Law fetch returned ${res.status} for ${sourceUrl}`);
          return null;
        }
        return await res.text();
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          this.logger.warn(`Kenya Law fetch retry ${attempt}/3 for ${sourceUrl}`);
          await kenyaLawThrottleBackoff(503, attempt);
        }
      }
    }

    this.logger.error('Kenya Law fetch failed', lastError);
    return null;
  }

  private parseLegacyRegexSections(body: string, sourceUrl: string): StatuteSectionFetchResult[] {
    const sections: StatuteSectionFetchResult[] = [];
    const sectionRegex =
      /(?:Section|Sec\.?|Article)\s*(\d+[A-Za-z]?)[\s.—-]+([^<\n]{10,500})/gi;
    let match: RegExpExecArray | null;

    while ((match = sectionRegex.exec(body)) !== null) {
      const text = match[2].trim().replace(/\s+/g, ' ');
      sections.push({
        section: match[1],
        title: text.slice(0, 120),
        summary: text.slice(0, 400),
        fullText: text,
        sourceUrl,
        sourceName: 'Kenya Law',
      });
    }

    return sections;
  }
}

/** Parse top-level AKN section blocks from Kenya Law HTML (public site, no token). */
export function parseKenyaLawAknHtmlSections(
  body: string,
  sourceUrl: string,
): StatuteSectionFetchResult[] {
  const document = parseDocument(body);
  return DomUtils.findAll(node => node.name === 'section' && /(?:^|\s)akn-section(?:\s|$)/.test(node.attribs?.class ?? ''), document.children)
    .flatMap(node => {
      const numNode = DomUtils.findOne(child => /(?:^|\s)akn-num(?:\s|$)/.test(child.attribs?.class ?? ''), node.children, true);
      const headingNode = DomUtils.findOne(child => child.name === 'h3' || /(?:^|\s)akn-heading(?:\s|$)/.test(child.attribs?.class ?? ''), node.children, true);
      const section = node.attribs?.id?.match(/(?:__)?sec_([^_]+)/)?.[1] ??
        (numNode ? DomUtils.textContent(numNode).replace(/[.\s]+$/g, '') : undefined) ??
        (headingNode ? DomUtils.textContent(headingNode).match(/^\s*(\d+[A-Za-z]?)/)?.[1] : undefined);
      const paragraphs = DomUtils.findAll(child => /(?:^|\s)akn-p(?:\s|$)/.test(child.attribs?.class ?? ''), node.children);
      const fullText = (paragraphs.length ? paragraphs.map(child => DomUtils.textContent(child)).join('\n\n') : DomUtils.textContent(node)).trim();
      if (!section || fullText.length < 8) return [];
      const heading = headingNode ? DomUtils.textContent(headingNode).replace(/\s+/g, ' ').trim() : '';
      return [{ section, title: heading || `Section ${section}`, summary: fullText.slice(0, 400), fullText, sourceUrl, sourceName: 'Kenya Law' }];
    });
}

function extractSectionNumFromId(openingTag: string): string | undefined {
  const idMatch = openingTag.match(/\bid="[^"]*__sec_([^"]+)"/i);
  if (!idMatch) return undefined;
  return idMatch[1].replace(/_/g, '');
}

function extractSectionNumFromHeading(chunk: string): string | undefined {
  const h3Match = chunk.match(/<h3>\s*(\d+[A-Za-z]?)\.\s*[\s\S]*?<\/h3>/i);
  return h3Match?.[1]?.trim();
}

function extractSectionHeading(chunk: string): string | undefined {
  const h3Match = chunk.match(/<h3>\s*\d+[A-Za-z]?\.\s*([\s\S]*?)<\/h3>/i);
  if (!h3Match) return undefined;
  return h3Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
}

function extractSectionText(chunk: string): string {
  const paragraphs = [...chunk.matchAll(/class="[^"]*akn-p[^"]*"[^>]*>([\s\S]*?)<\//gi)].map(
    (match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }
  return chunk.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
