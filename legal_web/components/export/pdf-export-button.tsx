"use client"

import { useState } from "react"
import { AlertTriangle, Download, Share2, FileText, Loader2, ChevronDown, FileType2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useExportBranding } from "@/lib/hooks/use-export-branding"
import { resolveExportLogos } from "@/lib/export/export-branding"
import {
  buildPdfExportHtml,
  buildWordExportHtml,
  type ExportMeta,
} from "@/lib/export/document-export-template"

export type { ExportMeta }

interface PdfExportButtonProps {
  title: string
  content: string
  meta?: ExportMeta
  className?: string
  variant?: "button" | "icon"
  label?: string
  /** Server-authorized export HTML; used for filing-grade downloads. */
  prepareHtml?: () => Promise<string>
}

/**
 * Client-side PDF export using the browser's print API.
 * Opens a print-optimised window with branded header (Umbrella logo + optional firm logo).
 */
export function PdfExportButton({
  title,
  content,
  meta,
  className,
  variant = "button",
  label = "Export PDF",
  prepareHtml,
}: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { umbrellaLogoUrl, firmLogoUrl } = useExportBranding()

  const handleExport = async () => {
    setLoading(true)
    try {
      const html = prepareHtml
        ? await prepareHtml()
        : await resolveExportLogos(firmLogoUrl).then((branding) =>
            buildPdfExportHtml(title, content, meta ?? {}, {
              umbrellaLogoSrc: branding.umbrellaLogoUrl,
              firmLogoDataUri: branding.firmLogoDataUri,
            }),
          )
      const printWindow = window.open("", "_blank", "width=900,height=700")
      if (!printWindow) return
      printWindow.document.write(html)
      printWindow.document.close()
    } finally {
      setTimeout(() => setLoading(false), 2000)
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={() => void handleExport()}
        disabled={loading}
        title={label}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50",
          className,
        )}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </button>
    )
  }

  return (
    <button
      onClick={() => void handleExport()}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {loading ? "Preparing…" : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Word export button
// ─────────────────────────────────────────────────────────────────────────────

interface WordExportButtonProps {
  title: string
  content: string
  meta?: ExportMeta
  className?: string
  variant?: "button" | "icon"
  label?: string
  /** Server-authorized export HTML; used for filing-grade downloads. */
  prepareHtml?: () => Promise<string>
}

export function WordExportButton({
  title,
  content,
  meta,
  className,
  variant = "button",
  label = "Export Word",
  prepareHtml,
}: WordExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { umbrellaLogoUrl, firmLogoUrl } = useExportBranding()

  const handleExport = async () => {
    setLoading(true)
    try {
      const html = prepareHtml
        ? await prepareHtml()
        : await resolveExportLogos(firmLogoUrl).then((branding) =>
            buildWordExportHtml(title, content, meta ?? {}, {
              umbrellaLogoSrc: branding.umbrellaLogoUrl,
              firmLogoDataUri: branding.firmLogoDataUri,
            }),
          )
      const blob = new Blob(["\ufeff", html], { type: "application/msword" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const filename =
        title
          .replace(/[^a-z0-9\s-]/gi, "")
          .trim()
          .replace(/\s+/g, "_")
          .slice(0, 80) || "document"
      a.download = `${filename}.doc`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={() => void handleExport()}
        disabled={loading}
        title={label}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50",
          className,
        )}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />}
      </button>
    )
  }

  return (
    <button
      onClick={() => void handleExport()}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />}
      {loading ? "Preparing…" : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined export menu — PDF + Word in a single dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface ResearchExportMenuProps {
  title: string
  content: string
  meta?: ExportMeta
  className?: string
  /** Prevent clean export; only a conspicuously marked review draft is produced. */
  draftOnly?: boolean
  verificationAppendix?: string
  onUnsafeAttempt?: (action: "pdf" | "docx") => void
}

/**
 * Dropdown export button that offers both PDF (browser print) and Word (.doc blob) export.
 * Drop-in replacement for PdfExportButton on the research results toolbar.
 */
export function ResearchExportMenu({
  title,
  content,
  meta,
  className,
  draftOnly = false,
  verificationAppendix,
  onUnsafeAttempt,
}: ResearchExportMenuProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [wordLoading, setWordLoading] = useState(false)
  const { umbrellaLogoUrl, firmLogoUrl } = useExportBranding()
  const exportContent = draftOnly && verificationAppendix
    ? `${content}\n\n---\n\n${verificationAppendix}`
    : content
  const exportMeta = draftOnly
    ? {
        ...(meta ?? {}),
        watermark: "UNVERIFIED DRAFT — NOT FOR RELIANCE",
        disclaimer:
          "UNVERIFIED REVIEW DRAFT. Verification is incomplete or unsafe. Do not file, cite, or advise from this document until the appendix issues are resolved.",
      }
    : (meta ?? {})

  const handlePdf = async () => {
    if (draftOnly) onUnsafeAttempt?.("pdf")
    setPdfLoading(true)
    try {
      const branding = await resolveExportLogos(firmLogoUrl)
      const html = buildPdfExportHtml(title, exportContent, exportMeta, {
        umbrellaLogoSrc: branding.umbrellaLogoUrl,
        firmLogoDataUri: branding.firmLogoDataUri,
      })
      const printWindow = window.open("", "_blank", "width=900,height=700")
      if (!printWindow) return
      printWindow.document.write(html)
      printWindow.document.close()
    } finally {
      setTimeout(() => setPdfLoading(false), 2000)
    }
  }

  const handleWord = async () => {
    if (draftOnly) onUnsafeAttempt?.("docx")
    setWordLoading(true)
    try {
      const branding = await resolveExportLogos(firmLogoUrl)
      const html = buildWordExportHtml(title, exportContent, exportMeta, {
        umbrellaLogoSrc: branding.umbrellaLogoUrl,
        firmLogoDataUri: branding.firmLogoDataUri,
      })
      const blob = new Blob(["\ufeff", html], { type: "application/msword" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const filename =
        title
          .replace(/[^a-z0-9\s-]/gi, "")
          .trim()
          .replace(/\s+/g, "_")
          .slice(0, 80) || "research"
      a.download = `${filename}.doc`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setWordLoading(false)
    }
  }

  const busy = pdfLoading || wordLoading

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 px-2.5",
            className,
          )}
          title={draftOnly ? "Export watermarked review draft" : "Export"}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-medium">{draftOnly ? "Draft export" : "Export"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {draftOnly && (
          <div className="flex gap-2 border-b px-2 py-2 text-[10px] leading-snug text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Clean export blocked. Draft includes a watermark and verification appendix.
          </div>
        )}
        <DropdownMenuItem
          onClick={() => void handlePdf()}
          disabled={pdfLoading}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5 text-red-500" />
          <span>{draftOnly ? "Draft PDF" : "Export as PDF"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleWord()}
          disabled={wordLoading}
          className="gap-2 cursor-pointer"
        >
          <FileType2 className="h-3.5 w-3.5 text-blue-500" />
          <span>{draftOnly ? "Draft Word" : "Export as Word"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Share button
// ─────────────────────────────────────────────────────────────────────────────

interface ShareButtonProps {
  title: string
  text: string
  url?: string
  className?: string
  label?: string
}

export function ShareButton({ title, text, url, className, label = "Share" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: url ?? window.location.href })
        return
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={() => void handleShare()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors",
        className,
      )}
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? "Copied!" : label}
    </button>
  )
}
