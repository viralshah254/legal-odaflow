import type { UseFormSetValue } from "react-hook-form"
import type { ProspectPrefill } from "@/lib/api/auth"
import type { LocationSyncRefs } from "@/lib/auth/sign-up-location-sync"
import { getPhoneCountry } from "@/lib/phone"

type AccountPath = "individual" | "lawFirm"
type IndividualRole = "client" | "lawyer"

export function applyProspectPrefill(params: {
  prefill: ProspectPrefill
  setValue: UseFormSetValue<{
    firmName?: string
    name?: string
    countryCode: string
    jurisdiction?: string
    email: string
    password: string
    confirmPassword: string
  }>
  setAccountPath: (path: AccountPath) => void
  setIndividualRole: (role: IndividualRole) => void
  setPhoneCountryCode: (code: string) => void
  setPhoneNational: (national: string) => void
  locationRefs: LocationSyncRefs
  currentValues: {
    name?: string
    firmName?: string
    jurisdiction?: string
    countryCode?: string
    phoneNational?: string
  }
}): boolean {
  const {
    prefill,
    setValue,
    setAccountPath,
    setIndividualRole,
    setPhoneCountryCode,
    setPhoneNational,
    locationRefs,
    currentValues,
  } = params

  if (prefill.practiceType === "FIRM") {
    setAccountPath("lawFirm")
  } else {
    setAccountPath("individual")
    setIndividualRole("lawyer")
  }

  if (prefill.name && !currentValues.name?.trim()) {
    setValue("name", prefill.name)
  }

  if (prefill.firmName && !currentValues.firmName?.trim()) {
    setValue("firmName", prefill.firmName)
  }

  if (prefill.countryCode && !locationRefs.countryManuallySet.current && !currentValues.countryCode) {
    setValue("countryCode", prefill.countryCode)
    if (!locationRefs.phoneCountryManuallySet.current) {
      setPhoneCountryCode(prefill.countryCode)
    }
  }

  if (
    prefill.jurisdiction &&
    !locationRefs.jurisdictionManuallySet.current &&
    !currentValues.jurisdiction?.trim()
  ) {
    setValue("jurisdiction", prefill.jurisdiction)
  }

  if (prefill.phone && !currentValues.phoneNational?.trim() && !locationRefs.phoneCountryManuallySet.current) {
    if (prefill.phone.startsWith("+91")) {
      setPhoneCountryCode("IN")
      setPhoneNational(prefill.phone.slice(3))
    } else if (prefill.phone.startsWith("+")) {
      const country = getPhoneCountry(prefill.countryCode || "IN")
      if (prefill.phone.startsWith(`+${country.dialCode}`)) {
        setPhoneCountryCode(country.iso2)
        setPhoneNational(prefill.phone.slice(country.dialCode.length + 1))
      }
    }
  }

  return true
}
