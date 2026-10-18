"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  INDIA_DRAFT_CATEGORIES,
  INDIA_DRAFT_FORMATS,
  getCategoryColor,
  type IndiaDraftCategory,
} from "@/lib/india-drafting/formats"



interface IndiaDraftingWorkspaceProps {
  context?: "lawyer" | "consumer"
  templateBasePath?: string
}

export function IndiaDraftingWorkspace({
  context = "lawyer",
  templateBasePath = "/app/india-drafting",
}: IndiaDraftingWorkspaceProps) {
  const router = useRouter()
  const [category, setCategory] = useState<IndiaDraftCategory>("All")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return INDIA_DRAFT_FORMATS.filter(f => {
      const matchesCategory = category === "All" || f.category === category
      const matchesSearch =
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.subtitle.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [category, search])

  const handleSelect = (format: (typeof INDIA_DRAFT_FORMATS)[number]) => {
    const params = new URLSearchParams({
      kind: format.id,
      label: format.label,
      subtitle: format.subtitle,
      category: format.category,
    })
    router.push(`${templateBasePath}/draft?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/legal-forms"
          className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
        >
          Browse India forms catalog (591 rows) →
        </Link>
        <span className="text-gray-500">{INDIA_DRAFT_FORMATS.length} curated AI kinds here</span>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search formats…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {INDIA_DRAFT_CATEGORIES.map(cat => {
          const color = cat === "All" ? "#7C3AED" : getCategoryColor(cat)
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
              style={
                selected
                  ? { backgroundColor: color, borderColor: color }
                  : { color }
              }
            >
              {cat !== "All" && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: selected ? "rgba(255,255,255,0.85)" : color }}
                />
              )}
              {cat}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {filtered.length} format{filtered.length === 1 ? "" : "s"} · {INDIA_DRAFT_FORMATS.length} India court documents
        {context === "consumer" ? " · Consumer drafting workspace" : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-12 text-center text-sm text-gray-500">
          No formats match your search.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(format => {
            const color = getCategoryColor(format.category)
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => handleSelect(format)}
                className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
              >
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          color,
                          backgroundColor: `${color}18`,
                        }}
                      >
                        {format.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {format.label}
                    </h3>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                      {format.subtitle}
                    </p>
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
