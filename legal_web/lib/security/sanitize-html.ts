import type { ClipboardEvent as ReactClipboardEvent } from "react"
import DOMPurify from "dompurify"

const DOCUMENT_ALLOWED_TAGS = [
  "p",
  "div",
  "span",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "a",
  "img",
  "mark",
  "blockquote",
  "hr",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "pre",
  "code",
]

const DOCUMENT_ALLOWED_ATTR = [
  "class",
  "href",
  "src",
  "alt",
  "title",
  "colspan",
  "rowspan",
  "target",
  "rel",
  "style",
  "width",
  "height",
]

const DOCUMENT_PURIFY_CONFIG = {
  ALLOWED_TAGS: DOCUMENT_ALLOWED_TAGS,
  ALLOWED_ATTR: DOCUMENT_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function sanitizeDocumentHtml(html: string): string {
  if (!html) return html
  return DOMPurify.sanitize(html, DOCUMENT_PURIFY_CONFIG)
}

/** Insert clipboard HTML as sanitized markup into a contentEditable selection. */
export function handleSanitizedPaste(event: ReactClipboardEvent<HTMLElement>): void {
  event.preventDefault()
  const html = event.clipboardData.getData("text/html")
  const text = event.clipboardData.getData("text/plain")
  const dirty = html || (text ? `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>` : "")
  if (dirty) {
    document.execCommand("insertHTML", false, sanitizeDocumentHtml(dirty))
  }
}
