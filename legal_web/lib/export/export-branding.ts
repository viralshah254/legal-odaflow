export interface ResolvedExportBranding {
  umbrellaLogoUrl: string
  /** data URI for the firm logo, or null if not enabled / not uploaded */
  firmLogoDataUri: string | null
}

/**
 * Resolve export logos for client-side exports.
 * - Umbrella logo: served from /brand/ (same origin, no CORS issue in print popups)
 * - Firm logo: fetched and converted to a data URI so the print popup window can
 *   render it without cross-origin restrictions.
 */
export async function resolveExportLogos(firmLogoUrl: string | null | undefined): Promise<ResolvedExportBranding> {
  const umbrellaLogoUrl = "/brand/umbrella-logo-light.png"

  if (!firmLogoUrl) {
    return { umbrellaLogoUrl, firmLogoDataUri: null }
  }

  if (firmLogoUrl.startsWith("data:")) {
    return { umbrellaLogoUrl, firmLogoDataUri: firmLogoUrl }
  }

  // Fetch firm logo as data URI to avoid CORS issues in the print popup
  try {
    const res = await fetch(firmLogoUrl)
    if (!res.ok) throw new Error("fetch failed")
    const blob = await res.blob()
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return { umbrellaLogoUrl, firmLogoDataUri: dataUri }
  } catch {
    return { umbrellaLogoUrl, firmLogoDataUri: null }
  }
}
