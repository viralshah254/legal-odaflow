"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function fieldLabelFromId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// DocumentOverviewPanel
// ---------------------------------------------------------------------------
interface DocumentOverviewPanelProps {
  documentTitle?: string | null
  documentType?: string | null
  situation?: string | null
}

export function DocumentOverviewPanel({
  documentTitle,
  documentType,
  situation,
}: DocumentOverviewPanelProps) {
  const [open, setOpen] = useState(true)
  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer select-none flex flex-row items-center justify-between hover:bg-accent/40 transition-colors rounded-t-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Document Overview</CardTitle>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-3 space-y-2">
          {documentTitle && (
            <p className="text-sm font-medium leading-snug">{documentTitle}</p>
          )}
          {documentType && (
            <Badge variant="secondary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {documentType.replace(/_/g, " ")}
            </Badge>
          )}
          {situation && (
            <p className="text-xs text-muted-foreground leading-relaxed">{situation}</p>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ClauseOutlinePanel
// ---------------------------------------------------------------------------
interface ClauseOutlinePanelProps {
  clauses: string[]
}

export function ClauseOutlinePanel({ clauses }: ClauseOutlinePanelProps) {
  const [open, setOpen] = useState(false)
  if (!clauses.length) return null
  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer select-none flex flex-row items-center justify-between hover:bg-accent/40 transition-colors rounded-t-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Clause Outline</CardTitle>
          <Badge variant="outline" className="text-xs ml-1">
            {clauses.length}
          </Badge>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-3">
          <ol className="space-y-1">
            {clauses.map((clause, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 text-primary font-medium w-4">{i + 1}.</span>
                <span>{clause}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SmartStepsPanel
// ---------------------------------------------------------------------------
export interface DraftingSmartStep {
  type: "fill_field" | "open_draft" | "generate_section" | string
  label: string
  fieldId?: string
  done?: boolean
}

interface SmartStepsPanelProps {
  steps: DraftingSmartStep[]
  onStepAction: (step: DraftingSmartStep) => void
}

export function SmartStepsPanel({ steps, onStepAction }: SmartStepsPanelProps) {
  const [open, setOpen] = useState(true)
  if (!steps.length) return null
  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer select-none flex flex-row items-center justify-between hover:bg-accent/40 transition-colors rounded-t-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Next Steps</CardTitle>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-3 space-y-1.5">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => onStepAction(step)}
              className={cn(
                "w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                step.done
                  ? "text-muted-foreground line-through opacity-50"
                  : "hover:bg-accent text-foreground",
              )}
            >
              <ChevronRight className="h-3 w-3 shrink-0 text-primary opacity-70" />
              {step.label}
            </button>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// EditableConfirmedFieldsPanel
// ---------------------------------------------------------------------------
interface EditableConfirmedFieldsPanelProps {
  fields: Record<string, unknown>
  drafts: Record<string, string>
  onDraftChange: (key: string, value: string) => void
  onSave: () => void
  saving: boolean
  regenerateAfterSave: boolean
  onRegenerateAfterSaveChange: (v: boolean) => void
  saveLabel: string
  regenerateLabel: string
}

export function EditableConfirmedFieldsPanel({
  fields,
  drafts,
  onDraftChange,
  onSave,
  saving,
  regenerateAfterSave,
  onRegenerateAfterSaveChange,
  saveLabel,
  regenerateLabel,
}: EditableConfirmedFieldsPanelProps) {
  const [open, setOpen] = useState(true)
  const entries = Object.entries(fields)
  if (!entries.length) return null

  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer select-none flex flex-row items-center justify-between hover:bg-accent/40 transition-colors rounded-t-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Confirmed Details</CardTitle>
          <Badge variant="outline" className="text-xs ml-1">
            {entries.length}
          </Badge>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-3 space-y-3">
          {entries.map(([key]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {fieldLabelFromId(key)}
              </Label>
              <Textarea
                rows={2}
                className="resize-none text-sm"
                value={drafts[key] ?? ""}
                onChange={(e) => onDraftChange(key, e.target.value)}
              />
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="regen-after-save"
              checked={regenerateAfterSave}
              onCheckedChange={(v) => onRegenerateAfterSaveChange(Boolean(v))}
            />
            <label htmlFor="regen-after-save" className="text-xs text-muted-foreground cursor-pointer">
              {regenerateLabel}
            </label>
          </div>

          <Button className="w-full" size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            {saveLabel}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
