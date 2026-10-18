import mammoth from "mammoth"
import { escapeHtml, sanitizeDocumentHtml } from "@/lib/security/sanitize-html"

export const TEMPLATE_UPLOAD_ACCEPT =
  ".docx,.doc,.html,.htm,.txt,.md,.rtf"

export interface ImportedTemplateFile {
  html: string
  fileName: string
  suggestedName: string
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim()
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return "<p></p>"
  }

  return paragraphs.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`).join("")
}

export function pasteTextToHtml(text: string): string {
  return sanitizeDocumentHtml(textToHtml(text))
}

export function suggestTitleFromPastedText(text: string): string {
  const firstLine = text
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstLine) return "Untitled template"
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine
}

async function importDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return sanitizeDocumentHtml(result.value.trim() || "<p></p>")
}

async function importTextFile(file: File): Promise<string> {
  const text = await file.text()
  return sanitizeDocumentHtml(textToHtml(text))
}

async function importHtmlFile(file: File): Promise<string> {
  const html = await file.text()
  return sanitizeDocumentHtml(html.trim() || "<p></p>")
}

export async function importTemplateFile(file: File): Promise<ImportedTemplateFile> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  let html = "<p></p>"

  if (extension === "docx" || extension === "doc") {
    html = await importDocx(file)
  } else if (extension === "html" || extension === "htm") {
    html = await importHtmlFile(file)
  } else if (["txt", "md", "rtf"].includes(extension)) {
    html = await importTextFile(file)
  } else {
    throw new Error("Unsupported file type. Upload DOCX, HTML, or TXT.")
  }

  return {
    html,
    fileName: file.name,
    suggestedName: stripExtension(file.name),
  }
}
