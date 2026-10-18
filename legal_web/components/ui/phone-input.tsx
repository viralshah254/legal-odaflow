"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PHONE_COUNTRIES, getPhoneCountry, orderPhoneCountries, validatePhone, digitsOnly } from "@/lib/phone"

interface PhoneInputProps {
  /** ISO-2 country code, e.g. "IN", "KE", "US" */
  countryCode: string
  /** Local / national number digits (no country prefix) */
  nationalNumber: string
  onCountryCodeChange: (iso2: string) => void
  onNationalNumberChange: (national: string) => void
  /** Pin this country at the top of the searchable dropdown (geo or profile default). */
  preferredCountryCode?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Fires whenever validation status changes */
  onValidChange?: (valid: boolean) => void
}

export function PhoneInput({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  preferredCountryCode,
  id,
  placeholder,
  disabled,
  className,
  onValidChange,
}: PhoneInputProps) {
  const t = useTranslations("common")
  const country = getPhoneCountry(countryCode)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 40)
  }, [open])

  // Emit validity
  useEffect(() => {
    const isValid = !digitsOnly(nationalNumber) || validatePhone(country, nationalNumber)
    onValidChange?.(isValid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nationalNumber, countryCode])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q) {
      return PHONE_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.includes(q) ||
          c.iso2.toLowerCase().includes(q),
      )
    }
    return orderPhoneCountries(PHONE_COUNTRIES, preferredCountryCode ?? countryCode)
  }, [search, preferredCountryCode, countryCode])

  const isValid = !digitsOnly(nationalNumber) || validatePhone(country, nationalNumber)

  const handleNationalChange = (raw: string) => {
    // Allow digits, spaces, dashes, parentheses
    onNationalNumberChange(raw.replace(/[^\d\s\-().]/g, ""))
  }

  return (
    <div className={cn("relative flex", className)} ref={dropdownRef}>
      {/* Country dial-code trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 shrink-0 rounded-l-md border border-r-0 bg-muted/50 px-2.5 py-2 text-sm",
          "hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          "min-w-[5rem]",
          disabled && "opacity-50 cursor-not-allowed",
          !isValid && digitsOnly(nationalNumber) && "border-destructive",
        )}
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="font-medium text-xs text-muted-foreground">+{country.dialCode}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* National number input */}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        value={nationalNumber}
        onChange={(e) => handleNationalChange(e.target.value)}
        placeholder={placeholder ?? country.example}
        className={cn(
          "flex-1 rounded-r-md border bg-background px-3 py-2 text-base md:text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !isValid && digitsOnly(nationalNumber) && "border-destructive focus:ring-destructive/50",
        )}
      />

      {/* Inline error hint */}
      {!isValid && digitsOnly(nationalNumber) && (
        <span className="absolute -bottom-5 left-0 text-[0.68rem] text-destructive whitespace-nowrap pointer-events-none">
          Invalid {country.name} number format
        </span>
      )}

      {/* Country dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-background shadow-xl overflow-hidden">
          <div className="p-2 border-b">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_country")}
              className="w-full rounded-md border bg-muted/30 px-2.5 py-1.5 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground text-center">{t("no_countries_found")}</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => {
                    onCountryCodeChange(c.iso2)
                    setOpen(false)
                    setSearch("")
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors",
                    c.iso2 === country.iso2 && "bg-primary/10 font-medium",
                  )}
                >
                  <span className="text-base w-6 text-center leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">+{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
