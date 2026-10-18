"use client"

import { useState } from "react"
import { BookMarked, Loader2, Plus, Scale, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionFinderPickerDialog } from "@/components/india-drafting/SectionFinderPickerDialog"
import {
  resolveIndiaDraftCaseLaw,
  type PinnedCaseLaw,
  type PinnedSection,
} from "@/lib/api/india-drafting"
import { useToast } from "@/hooks/use-toast"

export interface DraftPinnedAuthoritiesValue {
  pinnedSections: PinnedSection[]
  pinnedCaseLaws: PinnedCaseLaw[]
}

interface DraftPinnedAuthoritiesEditorProps {
  value: DraftPinnedAuthoritiesValue
  onChange: (next: DraftPinnedAuthoritiesValue) => void
  /** When set, shows a Redraft CTA (output panel). */
  onRedraft?: () => void
  redrafting?: boolean
  compact?: boolean
  documentKind?: string
  jurisdiction?: string
}

export function DraftPinnedAuthoritiesEditor({
  value,
  onChange,
  onRedraft,
  redrafting = false,
  compact = false,
  documentKind,
  jurisdiction,
}: DraftPinnedAuthoritiesEditorProps) {
  const { toast } = useToast()
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [citation, setCitation] = useState("")
  const [caseName, setCaseName] = useState("")
  const [holding, setHolding] = useState("")
  const [lookingUp, setLookingUp] = useState(false)

  const addSection = (section: PinnedSection) => {
    const key = `${(section.actId ?? "").toLowerCase()}:${section.section}`
    if (
      value.pinnedSections.some(
        (s) => `${(s.actId ?? "").toLowerCase()}:${s.section}` === key,
      )
    ) {
      toast({ title: "Already pinned", description: section.label ?? section.section })
      return
    }
    onChange({
      ...value,
      pinnedSections: [...value.pinnedSections, section],
    })
  }

  const removeSection = (index: number) => {
    onChange({
      ...value,
      pinnedSections: value.pinnedSections.filter((_, i) => i !== index),
    })
  }

  const removeCaseLaw = (index: number) => {
    onChange({
      ...value,
      pinnedCaseLaws: value.pinnedCaseLaws.filter((_, i) => i !== index),
    })
  }

  const addCaseLawPin = (pin: PinnedCaseLaw) => {
    const cite = pin.citation.trim().toLowerCase()
    if (value.pinnedCaseLaws.some((c) => c.citation.trim().toLowerCase() === cite)) {
      toast({ title: "Already pinned", description: pin.citation })
      return
    }
    onChange({
      ...value,
      pinnedCaseLaws: [...value.pinnedCaseLaws, pin],
    })
    setCitation("")
    setCaseName("")
    setHolding("")
  }

  const lookupCaseLaw = async (soft: boolean) => {
    const c = citation.trim()
    if (c.length < 3) {
      toast({ title: "Citation required", variant: "destructive" })
      return
    }
    setLookingUp(true)
    try {
      const result = await resolveIndiaDraftCaseLaw({
        citation: c,
        caseName: caseName.trim() || undefined,
        holding: holding.trim() || undefined,
        kind: documentKind,
        jurisdiction,
        allowSoftPin: soft,
      })
      if (result.pin && (result.status === "found" || (soft && result.status === "not_found"))) {
        addCaseLawPin(result.pin)
        toast({
          title: result.status === "found" ? "Case law verified" : "Soft-pinned (unverified)",
          description: result.message,
        })
        return
      }
      toast({
        title: "Not found",
        description: result.message ?? "Try soft-pin as unverified.",
        variant: "destructive",
      })
    } catch (err) {
      toast({
        title: "Lookup failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Scale className="h-3.5 w-3.5" />
            Statute sections
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSectionPickerOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add from Section Finder
          </Button>
        </div>
        {value.pinnedSections.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Pin BNSS/BNS/CrPC sections, then redraft so the draft must cite them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.pinnedSections.map((s, i) => (
              <span
                key={`${s.actId}-${s.section}-${i}`}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs"
              >
                <span className="truncate">
                  {s.label ?? `${s.actId?.toUpperCase() ?? ""} §${s.section}`}
                  {s.source === "user_unresolved" ? " (unverified)" : ""}
                </span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Remove section"
                  onClick={() => removeSection(i)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <BookMarked className="h-3.5 w-3.5" />
          Case laws
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="Citation e.g. (2020) 14 SCC 150"
          />
          <Input
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="Case name (optional)"
          />
        </div>
        <Input
          className="mt-2"
          value={holding}
          onChange={(e) => setHolding(e.target.value)}
          placeholder="Holding / note (optional)"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={lookingUp || citation.trim().length < 3}
            onClick={() => void lookupCaseLaw(false)}
          >
            {lookingUp ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Looking up…
              </>
            ) : (
              "Look up & pin"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={lookingUp || citation.trim().length < 3}
            onClick={() => void lookupCaseLaw(true)}
          >
            Soft-pin unverified
          </Button>
        </div>
        {value.pinnedCaseLaws.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {value.pinnedCaseLaws.map((c, i) => (
              <span
                key={`${c.citation}-${i}`}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs"
              >
                <span className="truncate">
                  {c.caseName ? `${c.caseName} — ` : ""}
                  {c.citation}
                  {c.source === "user" && !c.authorityId ? " (unverified)" : ""}
                </span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Remove case law"
                  onClick={() => removeCaseLaw(i)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {onRedraft ? (
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={redrafting}
          onClick={onRedraft}
        >
          {redrafting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redrafting…
            </>
          ) : (
            "Redraft with additions"
          )}
        </Button>
      ) : null}

      <SectionFinderPickerDialog
        open={sectionPickerOpen}
        onOpenChange={setSectionPickerOpen}
        onPin={addSection}
      />
    </div>
  )
}
