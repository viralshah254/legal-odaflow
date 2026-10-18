"use client"

import { useEffect, useRef } from "react"
import { X, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SmartDraftRenderer } from "@/components/india-drafting/SmartDraftRenderer"
import { DraftAccuracyPanel } from "@/components/drafting/accuracy/DraftAccuracyPanel"
import { BlankQuickFillPanel } from "@/components/india-drafting/BlankQuickFillPanel"
import { PdfExportButton, WordExportButton } from "@/components/export/pdf-export-button"
import { TableOfAuthoritiesPanel, type RichCitationAppendixEntry } from "@/components/citations/TableOfAuthoritiesPanel"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import type { CitationAppendixEntry } from "@/lib/api/india-drafting"

type ViewMode = "fill" | "edit"

interface DraftFullscreenModalProps {
  open: boolean
  onClose: () => void
  draft: string
  blanks: string[]
  onBlanksChange: (blanks: string[]) => void
  editedText: string | null
  onEditedTextChange: (text: string | null) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  label: string
  kind: string
  caseDetails: string
  tenantId?: string
  verification?: DraftVerificationAudit | null
  onVerificationChange?: (audit: DraftVerificationAudit | null) => void
  jurisdiction?: string
  displayText: string
  exportMeta?: Record<string, unknown>
  citationAppendix?: CitationAppendixEntry[]
  engineVersion?: "v1" | "v2" | "v3"
}

export function DraftFullscreenModal({
  open,
  onClose,
  draft,
  blanks,
  onBlanksChange,
  editedText,
  onEditedTextChange,
  viewMode,
  onViewModeChange,
  label,
  kind,
  caseDetails,
  tenantId,
  verification,
  displayText,
  citationAppendix,
  engineVersion,
}: DraftFullscreenModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Escape to close.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Auto-grow textarea.
  useEffect(() => {
    if (viewMode === "edit" && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [viewMode, editedText])

  if (!open) return null

  const wordCount = displayText.split(/\s+/).filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Draft full screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-foreground truncate max-w-[240px]">{label}</span>
          {/* View mode toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              onClick={() => onViewModeChange("fill")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "fill"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Fill blanks
            </button>
            <button
              onClick={() => {
                if (viewMode !== "edit") {
                  onEditedTextChange(editedText ?? displayText)
                }
                onViewModeChange("edit")
              }}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Edit text
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PdfExportButton
            content={displayText}
            title={label}
            className="h-7 text-xs"
          />
          <WordExportButton
            content={displayText}
            title={label}
            className="h-7 text-xs"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close full screen (Escape)"
            title="Close full screen (Escape)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body — 65 / 35 split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — document */}
        <div className="flex-[65] overflow-y-auto">
          {viewMode === "fill" ? (
            <SmartDraftRenderer
              draft={draft}
              blanks={blanks}
              onBlanksChange={onBlanksChange}
            />
          ) : (
            <div className="relative p-6">
              <textarea
                ref={textareaRef}
                value={editedText ?? displayText}
                onChange={e => onEditedTextChange(e.target.value)}
                className="w-full resize-none font-serif text-sm leading-relaxed bg-transparent border-0 outline-none text-gray-800 dark:text-gray-200 min-h-[400px]"
                spellCheck
              />
              <span className="absolute bottom-2 right-6 text-[10px] text-muted-foreground pointer-events-none">
                {wordCount} words
              </span>
            </div>
          )}
        </div>

        {/* Right — accuracy + quick fill */}
        <div className="flex-[35] border-l overflow-y-auto bg-muted/20 flex flex-col gap-4 p-4">
          {viewMode === "fill" && (
            <BlankQuickFillPanel
              draft={draft}
              blanks={blanks}
              onBlanksChange={onBlanksChange}
              kind={kind}
              caseDetails={caseDetails}
              tenantId={tenantId}
            />
          )}
          {verification && (
            <DraftAccuracyPanel
              verification={verification}
            />
          )}
          {citationAppendix && citationAppendix.length > 0 && (
            <TableOfAuthoritiesPanel
              entries={citationAppendix as RichCitationAppendixEntry[]}
              engineVersion={engineVersion}
              compact={false}
            />
          )}
        </div>
      </div>

      {/* Bottom status */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/10 shrink-0">
        <span>{wordCount} words · {displayText.length} characters</span>
        <span className="flex items-center gap-1"><Minimize2 className="h-3 w-3" /> Press Esc to exit</span>
      </div>
    </div>
  )
}
