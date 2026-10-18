"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  US_DRAFT_CATEGORIES,
  US_DRAFT_FORMATS,
  US_STATE_OPTIONS,
  getUsCategoryColor,
  type UsDraftCategory,
} from "@/lib/us-drafting/formats"

type CatalogTab = "all" | "federal" | "state" | "official"

interface UsDraftingWorkspaceProps {
  templateBasePath?: string
}

export function UsDraftingWorkspace({
  templateBasePath = "/app/us-drafting",
}: UsDraftingWorkspaceProps) {
  const router = useRouter()
  const [category, setCategory] = useState<UsDraftCategory>("All")
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("all")
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return US_DRAFT_FORMATS.filter(f => {
      const matchesTab =
        catalogTab === "all" ||
        (catalogTab === "federal" && f.jurisdiction === "Federal") ||
        (catalogTab === "state" && f.jurisdiction === "State" && f.catalogType !== "official") ||
        (catalogTab === "official" && f.catalogType === "official")
      const matchesCategory =
        category === "All" ||
        (category === "Federal" && f.jurisdiction === "Federal") ||
        (category === "State" && f.jurisdiction === "State" && f.catalogType !== "official") ||
        (category === "Official" && f.catalogType === "official") ||
        f.category === category
      const matchesState =
        !stateFilter ||
        !f.boundState ||
        f.boundState === stateFilter
      const matchesSearch =
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.subtitle.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.formNumber?.toLowerCase().includes(q) ?? false)
      return matchesTab && matchesCategory && matchesState && matchesSearch
    })
  }, [category, catalogTab, search, stateFilter])

  const handleSelect = (format: (typeof US_DRAFT_FORMATS)[number]) => {
    const stateCode = format.boundState ?? (format.requiresState && stateFilter ? stateFilter : undefined)
    if (format.requiresState && !stateCode) return

    const params = new URLSearchParams({
      kind: format.id,
      label: format.label,
      subtitle: format.subtitle,
      jurisdiction: format.jurisdiction,
      requiresState: String(format.requiresState),
    })
    if (stateCode) params.set("stateCode", stateCode)
    if (format.formNumber) params.set("formNumber", format.formNumber)
    if (format.boundState) params.set("boundState", format.boundState)
    router.push(`${templateBasePath}/draft?${params.toString()}`)
  }

  const federalCount = US_DRAFT_FORMATS.filter(f => f.jurisdiction === "Federal").length
  const stateBaseCount = US_DRAFT_FORMATS.filter(f => f.jurisdiction === "State" && f.catalogType !== "official").length
  const officialCount = US_DRAFT_FORMATS.filter(f => f.catalogType === "official").length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/legal-forms"
          className="rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-1 font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
        >
          Browse full catalog (10,800+ forms) →
        </Link>
        <span className="text-gray-500">{US_DRAFT_FORMATS.length} curated AI-draftable kinds here</span>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
        {([
          ["all", "All"],
          ["federal", "Federal"],
          ["state", "State Templates"],
          ["official", "Official State Forms"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCatalogTab(tab)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              catalogTab === tab
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search formats, form numbers…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All states</option>
          {US_STATE_OPTIONS.map(s => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {US_DRAFT_CATEGORIES.map(cat => {
          const color = cat === "All" ? "#1D4ED8" : getUsCategoryColor(cat)
          const selected = category === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                selected
                  ? "text-white border-transparent"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
              )}
              style={selected ? { backgroundColor: color, borderColor: color } : { color }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {filtered.length} shown · {federalCount} federal · {stateBaseCount} state templates × {US_STATE_OPTIONS.length} jurisdictions · {officialCount} official forms
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-12 text-center text-sm text-gray-500">
          No formats match your search.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(format => {
            const color = getUsCategoryColor(format.category)
            const needsState = format.requiresState && !format.boundState && !stateFilter
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => handleSelect(format)}
                disabled={needsState}
                className={cn(
                  "group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:border-blue-400 dark:hover:border-blue-600 transition-colors",
                  needsState && "opacity-60 cursor-not-allowed",
                )}
              >
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ color, backgroundColor: `${color}18` }}
                      >
                        {format.category}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">
                        {format.catalogType === "official" ? "Official" : format.jurisdiction}
                      </span>
                      {format.boundState && (
                        <span className="text-[10px] font-semibold text-teal-600 uppercase">{format.boundState}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {format.label}
                    </h3>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                      {format.formNumber ?? format.subtitle}
                    </p>
                    {needsState && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                        Select a state above before opening
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
