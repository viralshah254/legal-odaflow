"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen, ExternalLink, Sparkles } from "lucide-react"
import type { SavedResearchItem } from "@/lib/api/ai"
import { cn } from "@/lib/utils"

interface FiledResearchSidebarProps {
  items: SavedResearchItem[]
  loading?: boolean
  onFocusOnCanvas?: (savedResearchId: string) => void
  className?: string
}

export function FiledResearchSidebar({
  items,
  loading,
  onFocusOnCanvas,
  className,
}: FiledResearchSidebarProps) {
  return (
    <div className={cn("flex flex-col border-t border-white/8", className)}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/8">
        <BookOpen className="h-3 w-3 text-indigo-400/80" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Filed research
        </span>
        {items.length > 0 && (
          <span className="ml-auto text-[10px] text-white/30">{items.length}</span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {loading ? (
          <p className="px-3 py-2 text-[10px] text-white/30">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 text-[10px] leading-relaxed text-white/25">
            File research from Legal Research to see memos here.
          </p>
        ) : (
          items.map((item) => {
            const openHref = `/app/research?savedResearchId=${encodeURIComponent(item.id)}`
            return (
              <div
                key={item.id}
                className="group px-2 py-1.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-1">
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-purple-400/70" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white/80">{item.title}</p>
                    <p className="line-clamp-2 text-[10px] text-white/35">{item.query}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Link
                        href={openHref}
                        className="inline-flex items-center gap-0.5 text-[10px] text-indigo-400/90 hover:text-indigo-300"
                      >
                        Open <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                      </Link>
                      {onFocusOnCanvas && (
                        <button
                          type="button"
                          onClick={() => onFocusOnCanvas(item.id)}
                          className="text-[10px] text-white/40 hover:text-white/70"
                        >
                          On canvas
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
