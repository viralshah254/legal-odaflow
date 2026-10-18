"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { PromptRefinementHints } from "@/lib/api/prompt-refine"

export interface PromptRefineSheetProps {
  open: boolean
  loading?: boolean
  originalPrompt: string
  refinedPrompt: string
  hints?: PromptRefinementHints
  onAccept: (editedPrompt: string) => void
  onUseOriginal: () => void
  onCancel: () => void
}

export function PromptRefineSheet({
  open,
  loading = false,
  originalPrompt,
  refinedPrompt,
  hints,
  onAccept,
  onUseOriginal,
  onCancel,
}: PromptRefineSheetProps) {
  const t = useTranslations("promptRefine")
  const [edited, setEdited] = useState(refinedPrompt)
  const [showOriginal, setShowOriginal] = useState(false)

  useEffect(() => {
    if (open) {
      setEdited(refinedPrompt)
      setShowOriginal(false)
    }
  }, [open, refinedPrompt])

  const hintChips: Array<{ label: string; value: string }> = []
  if (hints?.jurisdiction) hintChips.push({ label: t("hintJurisdiction"), value: hints.jurisdiction })
  if (hints?.documentKind) hintChips.push({ label: t("hintDocument"), value: hints.documentKind })
  hints?.parties?.forEach((p) => hintChips.push({ label: t("hintParty"), value: p }))
  hints?.statutes?.forEach((s) => hintChips.push({ label: t("hintStatute"), value: s }))

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("yourOriginal")}
            {showOriginal ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showOriginal && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {originalPrompt}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("refinedLabel")}
            </label>
            <Textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              rows={8}
              className="resize-none text-sm"
              disabled={loading}
            />
          </div>

          {hintChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hintChips.map((chip) => (
                <Badge key={`${chip.label}-${chip.value}`} variant="secondary" className="text-xs font-normal">
                  <span className="text-muted-foreground mr-1">{chip.label}:</span>
                  {chip.value}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={loading || edited.trim().length < 3}
            onClick={() => onAccept(edited.trim())}
          >
            {t("continueRefined")}
          </Button>
          <Button variant="outline" className="w-full" disabled={loading} onClick={onUseOriginal}>
            {t("useOriginal")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
