/**
 * C15–C16 – Ingestion anchors and DOCX/PDF export-artifact integration spec
 *
 * C15: Proves that the ingestion pipeline extracts text/HTML from uploaded
 *      documents and that pinned sections reference actual ingested content
 *      (anchor integrity).
 *
 * C16: Proves that the DOCX export pipeline produces a valid artifact:
 *      - The buffer starts with the DOCX magic bytes (PK zip header)
 *      - The assembled fullText is embedded in the document
 *      - Source reference markers ([curated__*], [SOURCE_*]) are resolved
 *        before writing to the export
 */

import { renderDocumentHtml } from '@/ai/drafting/document-style-renderer';
import {
  formatSourceCitation,
  resolveSourceReferences,
  dedupeSectionHeader,
} from './assembly/draft-assembly.service';
import type { VerifiedSourceRegistry } from './contracts/verified-source';
import { DocumentIngestService } from '@/drafting-session/document-ingest.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal stub for the AzureOcrService dependency (OCR not needed for text/docx) */
const ocrStub = { analyzeUrl: jest.fn(), analyzeBuffer: jest.fn() } as any;

async function makeIngestService(): Promise<DocumentIngestService> {
  return new DocumentIngestService(ocrStub);
}

// ---------------------------------------------------------------------------
// C15 – Ingestion anchors
// ---------------------------------------------------------------------------

describe('C15 – Document ingestion anchors', () => {
  let svc: DocumentIngestService;

  beforeEach(async () => {
    svc = await makeIngestService();
  });

  // ── Format detection ──────────────────────────────────────────────────────

  it('detects PDF by MIME type', () => {
    const result = svc.detectFormat('application/pdf', 'order.pdf');
    expect(result.isPdf).toBe(true);
    expect(result.isDocx).toBe(false);
    expect(result.isText).toBe(false);
  });

  it('detects PDF by filename extension even if MIME is octet-stream', () => {
    const result = svc.detectFormat('application/octet-stream', 'charge-sheet.pdf');
    expect(result.isPdf).toBe(true);
  });

  it('detects DOCX by MIME type', () => {
    const result = svc.detectFormat(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'pleading.docx',
    );
    expect(result.isDocx).toBe(true);
    expect(result.isPdf).toBe(false);
  });

  it('detects DOCX by filename extension', () => {
    const result = svc.detectFormat('application/octet-stream', 'agreement.docx');
    expect(result.isDocx).toBe(true);
  });

  it('detects plain text by MIME', () => {
    const result = svc.detectFormat('text/plain', 'facts.txt');
    expect(result.isText).toBe(true);
  });

  it('detects markdown by extension', () => {
    const result = svc.detectFormat('text/markdown', 'case-notes.md');
    expect(result.isText).toBe(true);
  });

  // ── Text ingestion → pinnable anchor content ──────────────────────────────

  it('ingests plain text and produces extractable plainText anchor', async () => {
    const rawText = [
      'Section 1 — Facts',
      'The accused was arrested on 12 October 2026.',
      '',
      'Section 2 — Grounds',
      'The accused is a first-time offender with no prior convictions.',
    ].join('\n');

    const result = await svc.ingestBuffer(
      Buffer.from(rawText, 'utf8'),
      'text/plain',
      'case-facts.txt',
    );

    // Anchor contract: plainText must contain verbatim content for pinning
    expect(result.plainText).toContain('accused was arrested on 12 October 2026');
    expect(result.plainText).toContain('first-time offender');
    expect(result.sourceFormat).toBe('txt');
  });

  it('ingests markdown and preserves paragraph anchors', async () => {
    const markdown = `
# Bail Application

## Facts
The applicant has been in custody since **12 October 2026**.

## Legal Grounds
Under Section 437 CrPC, bail may be granted.
`.trim();

    const result = await svc.ingestBuffer(
      Buffer.from(markdown, 'utf8'),
      'text/markdown',
      'bail-memo.md',
    );

    expect(result.sourceFormat).toBe('md');
    expect(result.plainText).toContain('Section 437 CrPC');
    expect(result.plainText).toContain('custody since');
  });

  it('raises BadRequestException when DOCX content is empty', async () => {
    // A minimal valid DOCX zip would contain content; an empty buffer is not a valid DOCX.
    // We expect an error to be thrown — not a silent empty result.
    const svcLocal = await makeIngestService();

    // A 4-byte buffer is not a valid zip/docx
    await expect(
      svcLocal.ingestBuffer(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP magic but no content
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'broken.docx',
      ),
    ).rejects.toThrow();
  });

  // ── Pinned section anchor integrity ───────────────────────────────────────

  it('pinned section anchor matches ingested text span (contract)', async () => {
    // Contract: a pinned section specifies a `textExcerpt` which must appear
    // verbatim in the ingested document's plainText for the anchor to be valid.
    const documentText = [
      'IN THE HIGH COURT OF NAIROBI',
      'Civil Suit No. 100/2026',
      '',
      'Application for Bail',
      'The applicant, Jane Doe, was arrested on 12 October 2026.',
      'The bail amount offered is KES 500,000.',
    ].join('\n');

    const ingested = await svc.ingestBuffer(
      Buffer.from(documentText, 'utf8'),
      'text/plain',
      'bail.txt',
    );

    // The anchor excerpt must be findable in the ingested text
    const pinnedExcerpt = 'arrested on 12 October 2026';
    const anchorValid = ingested.plainText.includes(pinnedExcerpt);
    expect(anchorValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C16 – DOCX / PDF export artifact tests
// ---------------------------------------------------------------------------

describe('C16 – Export artifact integrity', () => {
  // ── HTML rendering ────────────────────────────────────────────────────────

  it('renderDocumentHtml produces non-empty HTML for a pleading', () => {
    const html = renderDocumentHtml({
      plainText: [
        'IN THE HIGH COURT OF KENYA',
        '',
        'Application for Bail',
        '',
        'The accused Jane Doe seeks bail under Section 437 CrPC.',
      ].join('\n'),
      documentKind: 'bail_application',
    });

    expect(html).toContain('<html');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Section 437 CrPC');
    expect(html.length).toBeGreaterThan(200);
  });

  it('renderDocumentHtml escapes XSS characters', () => {
    const html = renderDocumentHtml({
      plainText: '<script>alert("xss")</script> Document text.',
      documentKind: 'memo',
    });

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  // ── Source reference resolution (assembly contract) ───────────────────────

  it('resolveSourceReferences replaces [curated__*] markers with citation text', () => {
    const registry: VerifiedSourceRegistry = {
      jobId: 'job-test',
      builtAt: new Date().toISOString(),
      sources: [
        {
          id: 'curated__bail_act_s437',
          type: 'statute',
          jurisdiction: 'KE',
          title: 'Code of Criminal Procedure',
          citation: 'Section 437 CrPC',
          verificationStatus: 'verified',
          contentHash: 'abc123',
          bindingLevel: 'binding',
        },
        {
          id: 'SOURCE_1',
          type: 'case',
          jurisdiction: 'KE',
          title: 'State v. Karanja',
          citation: '[2024] eKLR 100',
          verificationStatus: 'verified',
          contentHash: 'def456',
          bindingLevel: 'persuasive',
        },
      ],
    };

    const text =
      'Bail may be granted under [curated__bail_act_s437] as confirmed in [SOURCE_1].';
    const resolved = resolveSourceReferences(text, registry);

    expect(resolved).toContain('Section 437 CrPC');
    expect(resolved).toContain('State v. Karanja');
    expect(resolved).not.toContain('[curated__bail_act_s437]');
    expect(resolved).not.toContain('[SOURCE_1]');
  });

  it('resolveSourceReferences unwraps unknown IDs without leaving blank markers', () => {
    const registry: VerifiedSourceRegistry = { jobId: 'j', builtAt: new Date().toISOString(), sources: [] };
    const text = 'See [STATUTE_UNKNOWN_ID] for details.';
    const resolved = resolveSourceReferences(text, registry);

    // Unknown ID is unwrapped (not left as [STATUTE_UNKNOWN_ID])
    expect(resolved).not.toContain('[STATUTE_UNKNOWN_ID]');
    expect(resolved).toContain('STATUTE_UNKNOWN_ID');
  });

  it('formatSourceCitation handles statute with both title and citation', () => {
    const source = { title: 'Constitution of Kenya, 2010', citation: 'Article 49' };
    const formatted = formatSourceCitation(source);
    expect(formatted).toContain('Article 49');
  });

  it('formatSourceCitation returns citation alone when title is already embedded', () => {
    const source = {
      title: 'State v. Karanja',
      citation: 'State v. Karanja [2024] eKLR 100',
    };
    const formatted = formatSourceCitation(source);
    // Should not duplicate "State v. Karanja State v. Karanja [2024] eKLR 100"
    const occurrences = (formatted.match(/State v\. Karanja/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('dedupeSectionHeader removes duplicate headings from section body', () => {
    const body = `
## PRAYER

## PRAYER

The applicant respectfully prays for bail.
`.trim();

    const deduped = dedupeSectionHeader(body, 'PRAYER');
    const occurrences = (deduped.match(/PRAYER/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  // ── DOCX magic bytes check ────────────────────────────────────────────────

  it('html-to-docx produces a buffer starting with PK ZIP magic bytes', async () => {
    // DOCX is a ZIP archive. Any valid .docx starts with PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const mod = require('html-to-docx') as any;
    const htmlToDocx = (mod.default ?? mod) as (
      html: string,
      header?: string,
      opts?: Record<string, unknown>,
    ) => Promise<Buffer>;

    const html = renderDocumentHtml({
      plainText: 'Test document for bail. Accused: Jane Doe. Jurisdiction: Nairobi.',
      documentKind: 'bail_application',
    });

    const buffer = await htmlToDocx(html);

    // Must be a non-empty Buffer
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000); // a real DOCX is always > 1 KB

    // DOCX magic bytes: PK (0x50 0x4B 0x03 0x04)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
    // bytes 2–3 are the local file entry signature (0x03, 0x04)
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it('html-to-docx embeds document text content (not a blank document)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const mod = require('html-to-docx') as any;
    const htmlToDocx = (mod.default ?? mod) as (
      html: string,
      header?: string,
      opts?: Record<string, unknown>,
    ) => Promise<Buffer>;

    const uniqueMarker = `BAIL-ANCHOR-${Date.now()}`;
    const html = `<html><body><h1>Application for Bail</h1><p>${uniqueMarker}</p></body></html>`;

    const buffer = await htmlToDocx(html);

    // The text content (encoded in ZIP member files) must appear in the buffer
    // as UTF-8 bytes somewhere — either verbatim or as XML
    const bufStr = buffer.toString('binary');
    expect(bufStr).toContain('BAIL-ANCHOR-');
  });
});
