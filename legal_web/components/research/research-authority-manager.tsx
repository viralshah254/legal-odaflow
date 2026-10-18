"use client"

import { useState } from "react"
import { Ban, Check, Gavel, Loader2, Pin, Plus, RotateCcw, Search } from "lucide-react"
import type { LegalResearchResponse } from "@/lib/api/types"
import type { ResearchAuthorityInput, ResearchAuthoritySearchItem } from "@/lib/api/ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Citation = LegalResearchResponse["citations"][number]

function displayList(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || undefined
  return value?.trim() || undefined
}

export function ResearchAuthorityManager({
  citations,
  pinnedAuthorityIds,
  excludedAuthorityIds,
  addedAuthorities,
  onPinnedChange,
  onExcludedChange,
  onAddedChange,
  onSearch,
  onApply,
  applying,
  disabled,
}: {
  citations: Citation[]
  pinnedAuthorityIds: string[]
  excludedAuthorityIds: string[]
  addedAuthorities: ResearchAuthorityInput[]
  onPinnedChange: (ids: string[]) => void
  onExcludedChange: (ids: string[]) => void
  onAddedChange: (items: ResearchAuthorityInput[]) => void
  onSearch: (query: string) => Promise<ResearchAuthoritySearchItem[]>
  onApply: () => void
  applying?: boolean
  disabled?: boolean
}) {
  const [newAuthority, setNewAuthority] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ResearchAuthoritySearchItem[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const keyFor = (citation: Citation, index: number) =>
    citation.authorityId ?? citation.citation ?? citation.url ?? `source-${index + 1}`

  function togglePin(key: string) {
    onPinnedChange(
      pinnedAuthorityIds.includes(key)
        ? pinnedAuthorityIds.filter((id) => id !== key)
        : [...pinnedAuthorityIds, key],
    )
    onExcludedChange(excludedAuthorityIds.filter((id) => id !== key))
  }

  function toggleExclude(key: string) {
    onExcludedChange(
      excludedAuthorityIds.includes(key)
        ? excludedAuthorityIds.filter((id) => id !== key)
        : [...excludedAuthorityIds, key],
    )
    onPinnedChange(pinnedAuthorityIds.filter((id) => id !== key))
  }

  async function searchAuthorities() {
    const query = newAuthority.trim()
    if (query.length < 2) return
    setSearching(true)
    setSearchError(null)
    try {
      setSearchResults(await onSearch(query))
    } catch (error) {
      setSearchResults([])
      setSearchError(error instanceof Error ? error.message : "Authority search failed")
    } finally {
      setSearching(false)
    }
  }

  function selectAuthority(authority: ResearchAuthoritySearchItem) {
    if (addedAuthorities.some((item) => item.authorityId === authority.authorityId)) return
    onAddedChange([...addedAuthorities, authority])
    setSearchResults((results) => results.filter((item) => item.authorityId !== authority.authorityId))
  }

  const hasChanges =
    pinnedAuthorityIds.length > 0 || excludedAuthorityIds.length > 0 || addedAuthorities.length > 0

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Gavel className="h-4 w-4 text-primary" />
            Authorities
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pin authorities to retain or exclude them from the refined memo.
          </p>
        </div>
        {hasChanges && (
          <button
            type="button"
            onClick={() => {
              onPinnedChange([])
              onExcludedChange([])
              onAddedChange([])
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      <div className="divide-y">
        {citations.map((citation, index) => {
          const key = keyFor(citation, index)
          const pinned = pinnedAuthorityIds.includes(key)
          const excluded = excludedAuthorityIds.includes(key)
          return (
            <div key={key} className={cn("flex items-start gap-3 px-4 py-3", excluded && "opacity-55")}>
              <span className="mt-0.5 text-xs font-semibold text-muted-foreground">[{index + 1}]</span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium leading-snug", excluded && "line-through")}>
                  {citation.caseName ?? displayList(citation.parties) ?? citation.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[citation.judgmentDate, citation.neutralCitation, citation.citation ?? citation.source]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {displayList(citation.relevantParagraphs) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Relevant paragraphs: {displayList(citation.relevantParagraphs)}
                  </p>
                )}
                {citation.propositionActuallyDecided && (
                  <p className="mt-1 text-xs leading-relaxed">
                    <span className="font-medium">Proposition decided:</span>{" "}
                    {citation.propositionActuallyDecided}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => togglePin(key)}
                  className={cn("rounded-md border p-1.5 text-muted-foreground hover:text-foreground", pinned && "border-primary/40 bg-primary/10 text-primary")}
                  aria-pressed={pinned}
                  aria-label={`${pinned ? "Unpin" : "Pin"} ${citation.title}`}
                  title="Pin authority"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleExclude(key)}
                  className={cn("rounded-md border p-1.5 text-muted-foreground hover:text-destructive", excluded && "border-destructive/40 bg-destructive/10 text-destructive")}
                  aria-pressed={excluded}
                  aria-label={`${excluded ? "Include" : "Exclude"} ${citation.title}`}
                  title="Exclude authority"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-3 border-t px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={newAuthority}
            onChange={(event) => setNewAuthority(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void searchAuthorities()
              }
            }}
            placeholder="Search by case, statute, or citation"
            aria-label="Search authorities"
          />
          <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => void searchAuthorities()} disabled={newAuthority.trim().length < 2 || searching}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        {searchResults.length > 0 && (
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {searchResults.map((authority) => (
              <div key={authority.authorityId} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{authority.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {authority.citation ?? authority.sourceName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {authority.relevanceReason}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => selectAuthority(authority)}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            ))}
          </div>
        )}
        {addedAuthorities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {addedAuthorities.map((authority, index) => (
              <button
                key={`${authority.title}-${index}`}
                type="button"
                onClick={() => onAddedChange(addedAuthorities.filter((_, itemIndex) => itemIndex !== index))}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs hover:border-destructive/40"
                title="Remove added authority"
              >
                <Check className="h-3 w-3 text-primary" /> {authority.title} ×
              </button>
            ))}
          </div>
        )}
        <Button type="button" className="w-full gap-2" onClick={onApply} disabled={!hasChanges || applying || disabled}>
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
          Apply authority choices
        </Button>
      </div>
    </section>
  )
}
