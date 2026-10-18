export type DocumentStyleCategory = 'pleading' | 'contract' | 'form' | 'memo' | 'application';

export interface DocumentStyleInput {
  plainText: string;
  category?: DocumentStyleCategory;
  documentKind?: string;
  title?: string;
  /** Pre-rendered HTML for Table of Authorities — appended at the end of the document. */
  tableOfAuthoritiesHtml?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inferCategory(kind?: string): DocumentStyleCategory {
  if (!kind) return 'pleading';
  const k = kind.toLowerCase();
  if (/contract|agreement|nda|lease|deed|poa|partnership/.test(k)) return 'contract';
  if (/memo|report|brief/.test(k)) return 'memo';
  if (/form_catalog|form_/.test(k)) return 'form';
  if (/application|notice|complaint/.test(k) && !/appeal|petition|revision|writ/.test(k)) {
    return 'application';
  }
  return 'pleading';
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length > 120) return false;
  if (/^(IN THE |BEFORE THE |MOST RESPECTFULLY|MOST RESPECTFULLY SHOWETH|GROUNDS|PRAYER|VERIFICATION|MEMORANDUM|CAUSE TITLE|INDEX)/i.test(t)) {
    return true;
  }
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length > 4 && !/^\d+\./.test(t)) {
    return true;
  }
  return false;
}

function renderPleadingBody(text: string): string {
  const lines = text.split('\n');
  const parts: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const block = buffer.join('\n').trim();
    if (!block) {
      buffer = [];
      return;
    }
    if (isHeading(block.split('\n')[0] ?? block)) {
      parts.push(`<h2 class="doc-heading">${escapeHtml(block).replace(/\n/g, '<br/>')}</h2>`);
    } else if (/^\d+\.\s/.test(block)) {
      parts.push(`<p class="doc-para numbered">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`);
    } else {
      parts.push(`<p class="doc-para">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`);
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flushBuffer();
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();
  return parts.join('\n');
}

const BASE_CSS = `
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; margin: 2cm; line-height: 1.8; color: #000; }
  .doc-title { font-size: 14pt; text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 1.5em; letter-spacing: 0.02em; }
  .doc-heading { font-size: 12pt; text-align: center; font-weight: bold; text-transform: uppercase; margin: 1.2em 0 0.8em; }
  .doc-para { text-align: justify; margin: 0 0 0.75em; text-indent: 0; }
  .doc-para.numbered { margin-left: 0; }
  .doc-section-prayer { margin-top: 2em; border-top: 1px solid #ccc; padding-top: 1em; }
  .contract-clause { margin: 0.5em 0; }
  .form-field { margin: 0.4em 0; }
`;

export function renderDocumentHtml(input: DocumentStyleInput): string {
  const category = input.category ?? inferCategory(input.documentKind);
  const body = renderPleadingBody(input.plainText);
  const titleBlock = input.title
    ? `<h1 class="doc-title">${escapeHtml(input.title)}</h1>`
    : '';

  let wrapperClass = 'doc-pleading';
  if (category === 'contract') wrapperClass = 'doc-contract';
  if (category === 'form') wrapperClass = 'doc-form';
  if (category === 'memo') wrapperClass = 'doc-memo';

  const toaBlock = input.tableOfAuthoritiesHtml ?? '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>${BASE_CSS}
  .${wrapperClass} { max-width: 18cm; margin: 0 auto; }
  .toa-block { page-break-before: always; }
  .toa-block h2 { font-size: 13pt; text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 1em; }
  .toa-block h3 { font-size: 11pt; font-weight: bold; margin: 0.8em 0 0.4em; }
  .toa-block table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .toa-block td { padding: 4px 6px; vertical-align: top; border-bottom: 1px solid #eee; }
  .toa-block ul { font-size: 10pt; margin: 0; padding-left: 1.5em; }
  .toa-block li { margin: 2px 0; }
</style>
</head>
<body>
<div class="${wrapperClass}">
${titleBlock}
${body}
</div>
${toaBlock}
</body>
</html>`;
}

export function renderDocumentPreviewHtml(input: DocumentStyleInput): string {
  const inner = renderPleadingBody(input.plainText);
  const category = input.category ?? inferCategory(input.documentKind);
  return `<div class="draft-styled-preview draft-${category}">${inner}</div>`;
}
