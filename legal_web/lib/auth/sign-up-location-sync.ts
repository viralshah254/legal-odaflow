import type { MutableRefObject } from "react"
import type { CountryCode } from "@/lib/api/types"
import { normalizeToSupportedCountry } from "@/lib/geo/detect-country"

export type LocationSyncRefs = {
  countryManuallySet: MutableRefObject<boolean>
  jurisdictionManuallySet: MutableRefObject<boolean>
  phoneCountryManuallySet: MutableRefObject<boolean>
}

/** When the user picks a phone country, mirror it to legal country unless they already chose one. */
export function syncPhoneCountryToLegal(
  phoneIso2: string,
  refs: LocationSyncRefs,
): { countryCode?: CountryCode; resetJurisdiction: boolean } {
  if (refs.countryManuallySet.current) {
    return { resetJurisdiction: false }
  }
  const legal = normalizeToSupportedCountry(phoneIso2) as CountryCode
  if (!legal) {
    return { resetJurisdiction: false }
  }
  return {
    countryCode: legal,
    resetJurisdiction: !refs.jurisdictionManuallySet.current,
  }
}

/** When the user picks a legal country, mirror it to the phone country unless they already chose one. */
export function syncLegalCountryToPhone(
  legalCode: CountryCode,
  refs: LocationSyncRefs,
): string | undefined {
  if (refs.phoneCountryManuallySet.current || !legalCode) return undefined
  return legalCode
}
