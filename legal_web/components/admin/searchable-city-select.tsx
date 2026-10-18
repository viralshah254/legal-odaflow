"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getCityOptions } from "@/lib/geo/country-cities"
import { isAllRegionsSelection } from "@/lib/geo/country-states"

interface SearchableCitySelectProps {
  countryCode: string
  stateName: string
  value: string
  onChange: (city: string) => void
  disabled?: boolean
  allowCustom?: boolean
  id?: string
  placeholder?: string
}

export function SearchableCitySelect({
  countryCode,
  stateName,
  value,
  onChange,
  disabled = false,
  allowCustom = true,
  id,
  placeholder = "Search city…",
}: SearchableCitySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const cities = useMemo(() => {
    if (!countryCode || isAllRegionsSelection(stateName) || !stateName.trim()) return []
    return getCityOptions(countryCode, stateName)
  }, [countryCode, stateName])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return cities.slice(0, 200)
    return cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 200)
  }, [cities, search])

  const trimmedSearch = search.trim()
  const showCustomOption =
    allowCustom &&
    trimmedSearch.length > 0 &&
    !cities.some((city) => city.toLowerCase() === trimmedSearch.toLowerCase())

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const isDisabled =
    disabled || !countryCode || isAllRegionsSelection(stateName) || !stateName.trim()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={isDisabled}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate text-left">
            {isDisabled ? "Select state first" : value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 ml-2 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type to search cities…"
          className="h-8 mb-2"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {cities.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No cities found for this state
            </p>
          ) : filtered.length === 0 && !showCustomOption ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No matches</p>
          ) : (
            filtered.map((city) => {
              const selected = city === value
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    onChange(city)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selected && "bg-accent font-medium",
                  )}
                >
                  {city}
                </button>
              )
            })
          )}
          {showCustomOption && (
            <button
              type="button"
              onClick={() => {
                onChange(trimmedSearch)
                setOpen(false)
              }}
              className="flex w-full rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
            >
              Use custom city: {trimmedSearch}
            </button>
          )}
          {filtered.length >= 200 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Showing first 200 matches — refine your search.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
