"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  findSection,
  resolveAndPinSection,
  suggestSection,
  type SectionFinderSuggestion,
} from "@/lib/api/section-finder"
import type { PinnedSection } from "@/lib/api/india-drafting"
import { useToast } from "@/hooks/use-toast"
import { getAccessToken } from "@/lib/api/client"

interface SectionFinderPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPin: (section: PinnedSection) => void
}

function entryToPin(entry: {
  id: string
  legalAuthorityId?: string
  newActId: string
  legacyActId: string
  newSection: string
  legacySection: string
  newActShort: string
  legacyActShort: string
  newTitle: string
  legacyTitle: string
  sectionText?: string
}): PinnedSection {
  const actId = (
    entry.newActId && entry.newActId !== "unchanged" ? entry.newActId : entry.legacyActId
  ).toLowerCase()
  const section = entry.newSection || entry.legacySection
  const actShort =
    entry.newActId && entry.newActId !== "unchanged"
      ? entry.newActShort || entry.newActId.toUpperCase()
      : entry.legacyActShort || entry.legacyActId.toUpperCase()
  const title = entry.newTitle || entry.legacyTitle
  return {
    actId,
    section,
    label: `${actShort} §${section}${title ? ` — ${title}` : ""}`,
    authorityId: entry.legalAuthorityId || entry.id,
    textExcerpt: entry.sectionText?.slice(0, 600),
    source: "section_finder",
  }
}

export function SectionFinderPickerDialog({
  open,
  onOpenChange,
  onPin,
}: SectionFinderPickerDialogProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<SectionFinderSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSuggestions([])
      setActiveIndex(0)
      setResolving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const timer = setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const rows = await suggestSection(q, "IN", 10, ac.signal)
        if (!ac.signal.aborted) {
          setSuggestions(rows)
          setActiveIndex(0)
        }
      } catch {
        if (!ac.signal.aborted) setSuggestions([])
      } finally {
        if (!ac.signal.aborted) setSuggestLoading(false)
      }
    }, 350)
    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [query, open])

  const resolveUnknown = useCallback(
    async (q: string, actId?: string, section?: string, soft = false) => {
      setResolving(true)
      try {
        const token = getAccessToken()
        const result = await resolveAndPinSection(
          {
            q,
            countryCode: "IN",
            actId,
            section,
            allowSoftPin: soft,
          },
          token ?? undefined,
        )
        if (result.pin && (result.status === "found" || result.status === "resolved_ingest")) {
          onPin(result.pin)
          toast({
            title: result.addedToSectionFinder
              ? "Added to Section Finder"
              : "Section pinned",
            description: result.message ?? result.pin.label,
          })
          onOpenChange(false)
          return
        }
        if (result.pin && result.status === "not_found" && soft) {
          onPin(result.pin)
          toast({
            title: "Soft-pinned (unverified)",
            description: result.message,
          })
          onOpenChange(false)
          return
        }
        toast({
          title: "Not found",
          description: result.message ?? "Try a different query, or soft-pin as unverified.",
          variant: "destructive",
        })
      } catch (err) {
        toast({
          title: "Resolve failed",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        })
      } finally {
        setResolving(false)
      }
    },
    [onPin, onOpenChange, toast],
  )

  const pinFromSuggestion = useCallback(
    async (suggestion: SectionFinderSuggestion) => {
      setResolving(true)
      try {
        const hint = {
          authorityId: suggestion.legalAuthorityId,
          actId: suggestion.actId,
          section: suggestion.sectionNumber,
        }
        const result = await findSection(
          suggestion.normalizedQuery || suggestion.displayLabel,
          "IN",
          undefined,
          undefined,
          undefined,
          hint,
        )
        const entry = result.resolvedSections?.[0] ?? result.matches?.[0]
        if (entry) {
          onPin(entryToPin(entry))
          toast({
            title: "Section pinned",
            description: entryToPin(entry).label,
          })
          onOpenChange(false)
          return
        }
        await resolveUnknown(
          suggestion.displayLabel,
          suggestion.actId,
          suggestion.sectionNumber,
        )
      } catch (err) {
        toast({
          title: "Lookup failed",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        })
      } finally {
        setResolving(false)
      }
    },
    [onPin, onOpenChange, toast, resolveUnknown],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add statute section</DialogTitle>
          <DialogDescription>
            Search Section Finder. If missing, we resolve via ingest and add it for future use.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. BNSS 480, CrPC 125, BNS 103"
            className="pl-9"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                const selected = suggestions[activeIndex]
                if (selected) void pinFromSuggestion(selected)
                else if (query.trim().length >= 2) void resolveUnknown(query.trim())
              }
            }}
          />
        </div>

        <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
          {suggestLoading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {!suggestLoading && suggestions.length === 0 && query.trim().length >= 2 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No suggestions. Use Resolve to look up / ingest.
            </p>
          )}
          {!suggestLoading &&
            suggestions.map((s, i) => (
              <button
                key={`${s.normalizedQuery}-${i}`}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50 ${
                  i === activeIndex ? "bg-muted/60" : ""
                }`}
                onClick={() => void pinFromSuggestion(s)}
                disabled={resolving}
              >
                <span className="font-medium">{s.displayLabel}</span>
                {s.title ? (
                  <span className="text-xs text-muted-foreground line-clamp-1">{s.title}</span>
                ) : null}
              </button>
            ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={resolving || query.trim().length < 2}
            onClick={() => void resolveUnknown(query.trim(), undefined, undefined, true)}
          >
            Soft-pin unverified
          </Button>
          <Button
            type="button"
            disabled={resolving || query.trim().length < 2}
            onClick={() => void resolveUnknown(query.trim())}
          >
            {resolving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resolving…
              </>
            ) : (
              "Resolve & pin"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
