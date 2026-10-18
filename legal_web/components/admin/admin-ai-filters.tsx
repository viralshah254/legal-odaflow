"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminAiFilters } from "@/lib/api/admin-extended"

interface AdminAiFiltersBarProps {
  filters: AdminAiFilters
  onChange: (next: AdminAiFilters) => void
}

export function AdminAiFiltersBar({ filters, onChange }: AdminAiFiltersBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <div>
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          className="h-8 text-xs mt-1"
          value={filters.from?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange({ ...filters, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined, offset: 0 })
          }
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          className="h-8 text-xs mt-1"
          value={filters.to?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange({ ...filters, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined, offset: 0 })
          }
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Task type</Label>
        <Input
          className="h-8 text-xs mt-1"
          placeholder="TEMPLATE_DRAFT"
          value={filters.taskType ?? ""}
          onChange={(e) => onChange({ ...filters, taskType: e.target.value || undefined, offset: 0 })}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Model</Label>
        <Input
          className="h-8 text-xs mt-1"
          placeholder="gpt-5.5"
          value={filters.modelName ?? ""}
          onChange={(e) => onChange({ ...filters, modelName: e.target.value || undefined, offset: 0 })}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Tenant ID</Label>
        <Input
          className="h-8 text-xs mt-1"
          value={filters.tenantId ?? ""}
          onChange={(e) => onChange({ ...filters, tenantId: e.target.value || undefined, offset: 0 })}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">User ID</Label>
        <Input
          className="h-8 text-xs mt-1"
          value={filters.userId ?? ""}
          onChange={(e) => onChange({ ...filters, userId: e.target.value || undefined, offset: 0 })}
        />
      </div>
    </div>
  )
}

interface PaginationBarProps {
  total: number
  limit: number
  offset: number
  onPage: (offset: number) => void
}

export function AdminPaginationBar({ total, limit, offset, onPage }: PaginationBarProps) {
  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex items-center justify-between gap-3 mt-3 text-xs text-muted-foreground">
      <span>
        Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 rounded border border-border disabled:opacity-40"
          disabled={offset <= 0}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="px-2 py-1 rounded border border-border disabled:opacity-40"
          disabled={offset + limit >= total}
          onClick={() => onPage(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
