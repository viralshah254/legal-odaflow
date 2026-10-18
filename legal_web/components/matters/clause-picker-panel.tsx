"use client"

import { useState } from "react"
import { CheckSquare2, ChevronDown, Info, Lock, Square } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ClauseEntry {
  title: string
  mandatory: boolean
  description?: string
}

interface ClausePickerPanelProps {
  catalog: ClauseEntry[]
  selected: string[]
  onChange: (selected: string[]) => void
}

function ClauseRow({
  entry,
  checked,
  onToggle,
}: {
  entry: ClauseEntry
  checked: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        entry.mandatory
          ? "border-border/60 bg-muted/30"
          : checked
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-transparent hover:border-border/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        {entry.mandatory ? (
          <span title="Mandatory clause" className="mt-0.5 shrink-0">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </span>
        ) : (
          <Checkbox
            id={`clause-${entry.title}`}
            checked={checked}
            onCheckedChange={onToggle}
            className="mt-0.5 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <label
            htmlFor={entry.mandatory ? undefined : `clause-${entry.title}`}
            className={cn(
              "text-sm leading-tight select-none",
              entry.mandatory ? "text-foreground cursor-default" : "cursor-pointer",
            )}
          >
            {entry.title}
          </label>
          {entry.description && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="h-2.5 w-2.5" />
                <ChevronDown
                  className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  {entry.description}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ClausePickerPanel({ catalog, selected, onChange }: ClausePickerPanelProps) {
  const mandatoryClauses = catalog.filter((c) => c.mandatory)
  const optionalClauses = catalog.filter((c) => !c.mandatory)

  const optionalSelected = optionalClauses.filter((c) => selected.includes(c.title))
  const allOptionalSelected = optionalClauses.length > 0 && optionalSelected.length === optionalClauses.length

  const toggle = (title: string) => {
    if (selected.includes(title)) {
      onChange(selected.filter((t) => t !== title))
    } else {
      onChange([...selected, title])
    }
  }

  const selectAllOptional = () => {
    const optionalTitles = optionalClauses.map((c) => c.title)
    const mandatoryTitles = mandatoryClauses.map((c) => c.title)
    onChange([...mandatoryTitles, ...optionalTitles])
  }

  const deselectAllOptional = () => {
    const mandatoryTitles = mandatoryClauses.map((c) => c.title)
    onChange(mandatoryTitles)
  }

  const selectedCount = selected.filter((t) =>
    optionalClauses.some((c) => c.title === t),
  ).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Clauses</span>
          <Badge
            variant="outline"
            className="text-[11px] tabular-nums border-primary/40 text-primary"
          >
            {mandatoryClauses.length + selectedCount} included
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Mandatory clauses are always included. Toggle optional clauses to customise the document.
        </p>
        {optionalClauses.length > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={allOptionalSelected ? deselectAllOptional : selectAllOptional}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {allOptionalSelected ? (
                <CheckSquare2 className="h-3 w-3" />
              ) : (
                <Square className="h-3 w-3" />
              )}
              {allOptionalSelected ? "Deselect optional" : "Select all optional"}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable clause list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Mandatory */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
            <Lock className="h-2.5 w-2.5" />
            Mandatory ({mandatoryClauses.length})
          </p>
          {mandatoryClauses.map((entry) => (
            <ClauseRow
              key={entry.title}
              entry={entry}
              checked={true}
              onToggle={() => {}}
            />
          ))}
        </div>

        {/* Optional */}
        {optionalClauses.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Optional ({optionalClauses.length})
            </p>
            {optionalClauses.map((entry) => (
              <ClauseRow
                key={entry.title}
                entry={entry}
                checked={selected.includes(entry.title)}
                onToggle={() => toggle(entry.title)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="px-3 pb-3 pt-2 border-t shrink-0">
        <p className="text-[11px] text-muted-foreground text-center">
          {mandatoryClauses.length} mandatory + {selectedCount} optional ={" "}
          <span className="font-semibold text-foreground">
            {mandatoryClauses.length + selectedCount} clauses
          </span>{" "}
          in document
        </p>
      </div>
    </div>
  )
}
