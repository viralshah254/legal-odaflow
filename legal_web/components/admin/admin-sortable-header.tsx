"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SortDir = "asc" | "desc"

interface AdminSortableHeaderProps<T extends string> {
  label: string
  field: T
  activeField: T
  activeDir: SortDir
  onSort: (field: T) => void
  className?: string
  align?: "left" | "right"
}

export function AdminSortableHeader<T extends string>({
  label,
  field,
  activeField,
  activeDir,
  onSort,
  className,
  align = "left",
}: AdminSortableHeaderProps<T>) {
  const active = activeField === field
  return (
    <TableHead className={cn(className, align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          align === "right" && "ml-auto -mr-1",
        )}
      >
        <span>{label}</span>
        {active ? (
          activeDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-35" />
        )}
      </button>
    </TableHead>
  )
}
