"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { getCountryName, TIER1_COUNTRY_CODES } from "@/lib/geo/detect-country"
import { useResearchCountries } from "@/lib/hooks/use-research-countries"

export function WorkspaceCountryMenu() {
  const { countryCode, countryName, workspaceCountryOverride, selectWorkspaceCountry } = useDetectedCountry()
  const { countries } = useResearchCountries()
  const codes = [...new Set([...TIER1_COUNTRY_CODES, ...countries.map(country => country.code), countryCode].filter(Boolean))]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0 gap-1 px-2" aria-label={`Workspace country: ${countryName || "detecting"}`}>
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-28 truncate hidden lg:inline">{countryName || "Country"}</span>
          <span className="lg:hidden">{countryCode}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 max-h-[65vh] overflow-y-auto">
        <DropdownMenuLabel>Country for new work</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-muted-foreground">Existing matters keep their jurisdiction.</p>
        <DropdownMenuRadioGroup value={workspaceCountryOverride ?? "auto"} onValueChange={value => selectWorkspaceCountry(value === "auto" ? null : value)}>
          <DropdownMenuRadioItem value="auto">Use my location</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {codes.map(code => (
            <DropdownMenuRadioItem key={code} value={code}>{getCountryName(code)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
