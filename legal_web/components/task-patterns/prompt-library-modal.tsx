"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  ClipboardList,
  FileSearch,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  listTaskPatterns,
  type LegalTaskPattern,
  type TaskPatternFeature,
} from "@/lib/api/task-patterns"
import {
  getFavoritePatternIds,
  launchTaskPattern,
  toggleFavoritePattern,
} from "@/lib/task-patterns/launch-task-pattern"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  domainsForJurisdiction,
  type Tier1Jurisdiction,
} from "@/lib/taxonomy/platform-taxonomy"

const FEATURES: { id: TaskPatternFeature | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "research", label: "Research" },
  { id: "review", label: "Review" },
  { id: "intake", label: "Intake" },
  { id: "law_library", label: "Law Library" },
  { id: "section_finder", label: "Section Finder" },
]

const FEATURE_BADGE: Record<TaskPatternFeature, string> = {
  draft: "Draft",
  research: "Research",
  review: "Review",
  intake: "Intake",
  copilot: "Copilot",
  law_library: "Law Library",
  section_finder: "Section Finder",
}

const JURISDICTIONS = ["IN", "US", "KE", "GB"] as const

export interface PromptLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultJurisdiction?: string
  defaultFeature?: TaskPatternFeature | "all"
  defaultDomainSlug?: string | null
}

export function PromptLibraryModal({
  open,
  onOpenChange,
  defaultJurisdiction = "IN",
  defaultFeature = "all",
  defaultDomainSlug = null,
}: PromptLibraryModalProps) {
  const router = useRouter()
  const { activeTenantId } = useTenant()
  const [jurisdiction, setJurisdiction] = useState(defaultJurisdiction)
  const [feature, setFeature] = useState<TaskPatternFeature | "all">(defaultFeature)
  const [tab, setTab] = useState<"all" | "favorites">("all")
  const [practiceFilter, setPracticeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [patterns, setPatterns] = useState<LegalTaskPattern[]>([])
  const [loading, setLoading] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setJurisdiction(defaultJurisdiction)
      setFeature(defaultFeature)
      setPracticeFilter(defaultDomainSlug)
      setFavorites(getFavoritePatternIds())
    }
  }, [open, defaultJurisdiction, defaultFeature, defaultDomainSlug])

  const loadPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listTaskPatterns({
        jurisdiction,
        targetFeature: feature === "all" ? undefined : feature,
        practiceArea: practiceFilter ?? undefined,
        q: search.trim() || undefined,
      })
      setPatterns(rows)
    } finally {
      setLoading(false)
    }
  }, [jurisdiction, feature, practiceFilter, search])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void loadPatterns(), search ? 250 : 0)
    return () => clearTimeout(t)
  }, [open, loadPatterns, search])

  const taxonomyDomains = useMemo(() => {
    const j = (JURISDICTIONS.includes(jurisdiction as (typeof JURISDICTIONS)[number])
      ? jurisdiction
      : "IN") as Tier1Jurisdiction
    return domainsForJurisdiction(
      j,
      feature === "all" ? undefined : feature,
      "professional",
    )
  }, [jurisdiction, feature])

  const visiblePatterns = useMemo(() => {
    if (tab === "favorites") {
      return patterns.filter((p) => favorites.includes(p.id))
    }
    return patterns
  }, [patterns, tab, favorites])

  const handleLaunch = (pattern: LegalTaskPattern) => {
    onOpenChange(false)
    void launchTaskPattern(pattern, {
      tenantId: activeTenantId ?? undefined,
      router,
    })
  }

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(toggleFavoritePattern(id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Task pattern library
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Curated starters that launch Research, Drafting, Review, and more with context pre-filled.
          </p>
        </DialogHeader>

        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patterns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              {JURISDICTIONS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={jurisdiction === c ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setJurisdiction(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              <Button
                type="button"
                size="sm"
                variant={tab === "all" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setTab("all")}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tab === "favorites" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setTab("favorites")}
              >
                <Star className="h-3 w-3 mr-1" />
                Favorites
              </Button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {FEATURES.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={feature === id ? "default" : "outline"}
                className="h-7 shrink-0 text-xs"
                onClick={() => setFeature(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="hidden md:block w-44 border-r shrink-0 overflow-y-auto p-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground px-2 mb-2">
              Practice domain
            </p>
            <button
              type="button"
              className={cn(
                "w-full text-left text-xs rounded-md px-2 py-1.5 mb-0.5",
                !practiceFilter && "bg-muted font-medium",
              )}
              onClick={() => setPracticeFilter(null)}
            >
              All domains
            </button>
            {taxonomyDomains.map((domain) => (
              <button
                key={domain.slug}
                type="button"
                className={cn(
                  "w-full text-left text-xs rounded-md px-2 py-1.5 mb-0.5 leading-snug",
                  practiceFilter === domain.slug && "bg-muted font-medium",
                )}
                onClick={() => setPracticeFilter(domain.slug)}
              >
                {domain.label}
              </button>
            ))}
          </aside>

          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visiblePatterns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {tab === "favorites"
                  ? "No favorites yet — star patterns to save them here."
                  : "No patterns match your filters."}
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {visiblePatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    role="button"
                    tabIndex={0}
                    className="text-left rounded-xl border p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors relative group cursor-pointer"
                    onClick={() => handleLaunch(pattern)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleLaunch(pattern)
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-1 rounded-md opacity-60 hover:opacity-100 z-10"
                      onClick={(e) => handleToggleFavorite(pattern.id, e)}
                      aria-label="Toggle favorite"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          favorites.includes(pattern.id)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                    <div className="flex flex-wrap gap-1 mb-2 pr-6">
                      <Badge variant="secondary" className="text-[10px]">
                        {FEATURE_BADGE[pattern.targetFeature]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {pattern.jurisdiction}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm leading-snug mb-1">{pattern.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {pattern.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground shrink-0 flex items-center justify-between">
          <span>Patterns launch the right workflow with pre-filled context.</span>
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
