"use client"

import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getFirmProfile } from "@/lib/api/governance"

export interface ExportBrandingState {
  /** URL of the Umbrella logo (always set) */
  umbrellaLogoUrl: string
  /** URL/data-uri of the firm logo, or null if disabled / not uploaded */
  firmLogoUrl: string | null
  firmDisplayName: string | null
}

/** Returns current export branding state for the active tenant. */
export function useExportBranding(): ExportBrandingState {
  const { activeTenantId } = useTenant()

  const { data: firmProfile } = useApiData(
    ["firm-profile", activeTenantId],
    {
      apiFn: () => getFirmProfile(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const showFirmLogo =
    firmProfile?.documentBranding?.showLogoOnExports === true &&
    Boolean(firmProfile?.logoUrl)

  return {
    umbrellaLogoUrl: "/brand/umbrella-logo-light.png",
    firmLogoUrl: showFirmLogo ? (firmProfile?.logoUrl ?? null) : null,
    firmDisplayName: firmProfile?.displayName ?? null,
  }
}
