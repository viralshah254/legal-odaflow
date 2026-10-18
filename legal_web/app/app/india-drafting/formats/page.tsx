"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, ArrowLeft, FileText } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  INDIA_DRAFT_FORMATS,
  INDIA_DRAFT_CATEGORIES,
  type IndiaDraftCategory,
} from "@/lib/india-drafting/formats"
import { cn } from "@/lib/utils"

const INDIA_STATE_LABELS: Record<string, string> = {
  GJ: "Gujarat",
  MH: "Maharashtra",
  DL: "Delhi",
  KA: "Karnataka",
  TN: "Tamil Nadu",
  TS: "Telangana",
  WB: "West Bengal",
  RJ: "Rajasthan",
  UP: "Uttar Pradesh",
  KL: "Kerala",
  PB: "Punjab",
  BR: "Bihar",
  MP: "Madhya Pradesh",
  OD: "Odisha",
  UK: "Uttarakhand",
  CG: "Chhattisgarh",
  JH: "Jharkhand",
  AS: "Assam",
  HP: "Himachal Pradesh",
  CH: "Chandigarh",
  JK: "Jammu & Kashmir",
}

/** High court label per state for family court context. */
const HC_LABEL: Record<string, string> = {
  GJ: "Gujarat High Court",
  MH: "Bombay High Court",
  DL: "Delhi High Court",
  KA: "Karnataka High Court",
  TN: "Madras High Court",
  TS: "Telangana High Court",
  WB: "Calcutta High Court",
  RJ: "Rajasthan High Court",
  UP: "Allahabad High Court",
  KL: "Kerala High Court",
  PB: "Punjab & Haryana High Court",
  BR: "Patna High Court",
  MP: "Madhya Pradesh High Court",
  OD: "Orissa High Court",
  UK: "Uttarakhand High Court",
  CG: "Chhattisgarh High Court",
  JH: "Jharkhand High Court",
  AS: "Gauhati High Court",
  HP: "Himachal Pradesh High Court",
  CH: "Punjab & Haryana High Court",
  JK: "J&K High Court",
}

export default function IndiaDraftFormatsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<IndiaDraftCategory>("All")
  const [jurisdiction, setJurisdiction] = useState<string>("")

  // Pre-populate jurisdiction from URL query param (set by hub page when jurisdiction is inferred)
  useEffect(() => {
    const j = searchParams.get("jurisdiction")
    if (j && j in INDIA_STATE_LABELS) setJurisdiction(j)
  }, [searchParams])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return INDIA_DRAFT_FORMATS.filter((fmt) => {
      if (activeCategory !== "All" && fmt.category !== activeCategory) return false
      if (!q) return true
      return (
        fmt.label.toLowerCase().includes(q) ||
        fmt.subtitle.toLowerCase().includes(q) ||
        fmt.id.toLowerCase().includes(q) ||
        fmt.category.toLowerCase().includes(q)
      )
    })
  }, [search, activeCategory])

  const hcLabel = jurisdiction ? HC_LABEL[jurisdiction] : undefined

  function handleDraft(id: string, label: string, category: string) {
    const params = new URLSearchParams({ kind: id, label, category })
    if (jurisdiction) params.set("jurisdiction", jurisdiction)
    router.push(`/app/india-drafting/draft?${params.toString()}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        href="/app/india-drafting"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Document Drafting
      </Link>

      <div>
        <h1 className="text-2xl font-bold">All India Document Types</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search or filter {INDIA_DRAFT_FORMATS.length}+ document types. Select your state to see court-specific context.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search — divorce, bail, maintenance, writ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All States</option>
          {Object.entries(INDIA_STATE_LABELS).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      {/* Jurisdiction banner */}
      {jurisdiction && hcLabel && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/20 px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-300">
          Showing documents for <strong>{INDIA_STATE_LABELS[jurisdiction]}</strong>. Family Court petitions are filed in the Family Court; maintenance/HMA revision goes to the <strong>{hcLabel}</strong>.
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {INDIA_DRAFT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} document{filtered.length !== 1 ? "s" : ""} found
        {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
        {search ? ` matching "${search}"` : ""}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different keyword or category.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((fmt) => (
            <div
              key={fmt.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 hover:border-indigo-400 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{fmt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmt.subtitle}</p>
                <Badge variant="secondary" className="mt-1.5 text-[10px]">{fmt.category}</Badge>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleDraft(fmt.id, fmt.label, fmt.category)}
              >
                Draft
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
