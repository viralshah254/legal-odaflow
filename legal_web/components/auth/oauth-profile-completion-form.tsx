"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CountryConfirmStep } from "@/components/issue-checker/country-confirm-step"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import {
  detectCountry,
  normalizeToSupportedCountry,
} from "@/lib/geo/detect-country"
import { matchRegionToStateOption } from "@/lib/geo/country-states"
import {
  resolveFirmName,
  validateSignUpMetadata,
  type AccountType,
  type PracticeType,
} from "@/lib/auth/sign-up-metadata"
import { getFirebaseIdToken } from "@/lib/firebase"
import { useAuth } from "@/lib/contexts/auth-context"
import { resolveReferralCode } from "@/lib/auth/referral-storage"
import { getDeviceId } from "@/lib/device/device-id"
import { setSoloIntent } from "@/lib/hooks/use-is-solo"
import { trackLawyerSignup } from "@/lib/analytics/posthog"
import { clearPersistedReferralCode } from "@/lib/auth/referral-storage"
import type { AuthResponse, CountryCode } from "@/lib/api/types"
import { PhoneInput } from "@/components/ui/phone-input"
import { resolveSignUpPhone } from "@/lib/auth/sign-up-phone"
import {
  syncLegalCountryToPhone,
  syncPhoneCountryToLegal,
  type LocationSyncRefs,
} from "@/lib/auth/sign-up-location-sync"
import { lookupAuthEmail } from "@/lib/api/auth"
import { getPhoneCountry } from "@/lib/phone"

export interface OAuthProfileCompletionFormProps {
  email: string
  initialName?: string | null
  referralCode?: string | null
  onComplete: (response: AuthResponse) => void
  onError: (message: string) => void
}

export function OAuthProfileCompletionForm({
  email,
  initialName,
  referralCode,
  onComplete,
  onError,
}: OAuthProfileCompletionFormProps) {
  const t = useTranslations("auth")
  const { loginWithFirebase } = useAuth()
  const {
    countryCode: detectedCountry,
    detectedRegion,
    isLoading: countryLoading,
  } = useDetectedCountry()

  const [accountType, setAccountType] = useState<AccountType>("CONSUMER")
  const [practiceType, setPracticeType] = useState<PracticeType>("FIRM")
  const [firmName, setFirmName] = useState("")
  const [name, setName] = useState(initialName ?? "")
  // Start empty — geo detection (effect below) will fill in the real country.
  const [countryCode, setCountryCode] = useState<CountryCode>("")
  const [jurisdiction, setJurisdiction] = useState("")
  const [isDetectingCountry, setIsDetectingCountry] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phoneCountryCode, setPhoneCountryCode] = useState("")
  const [phoneNational, setPhoneNational] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [prospectPrefillHint, setProspectPrefillHint] = useState(false)
  const countryManuallySet = useRef(false)
  const jurisdictionManuallySet = useRef(false)
  const phoneCountryManuallySet = useRef(false)

  const locationRefs: LocationSyncRefs = {
    countryManuallySet,
    jurisdictionManuallySet,
    phoneCountryManuallySet,
  }

  useEffect(() => {
    if (initialName && !name) {
      setName(initialName)
    }
  }, [initialName, name])

  useEffect(() => {
    let cancelled = false

    void lookupAuthEmail(email)
      .then((lookup) => {
        if (cancelled || lookup.exists || !lookup.prospectPrefill) return
        const prefill = lookup.prospectPrefill

        setAccountType("LAWYER")
        setPracticeType(prefill.practiceType)
        if (prefill.name) setName((current) => current || prefill.name)
        if (prefill.firmName) setFirmName(prefill.firmName)
        if (prefill.countryCode && !countryManuallySet.current) {
          setCountryCode(prefill.countryCode as CountryCode)
          if (!phoneCountryManuallySet.current) {
            setPhoneCountryCode(prefill.countryCode)
          }
        }
        if (prefill.jurisdiction && !jurisdictionManuallySet.current) {
          setJurisdiction(prefill.jurisdiction)
        }
        if (prefill.phone && !phoneCountryManuallySet.current) {
          if (prefill.phone.startsWith("+91")) {
            setPhoneCountryCode("IN")
            setPhoneNational((current) => current || prefill.phone!.slice(3))
          } else if (prefill.phone.startsWith("+")) {
            const country = getPhoneCountry(prefill.countryCode || "IN")
            if (prefill.phone.startsWith(`+${country.dialCode}`)) {
              setPhoneCountryCode(country.iso2)
              setPhoneNational(
                (current) =>
                  current || prefill.phone!.slice(country.dialCode.length + 1),
              )
            }
          }
        }
        setProspectPrefillHint(true)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [email])

  useEffect(() => {
    let cancelled = false

    async function applyGeoDetection() {
      setIsDetectingCountry(true)
      try {
        const detected = await detectCountry({ preferStored: false })
        if (cancelled || countryManuallySet.current) return
        setCountryCode(normalizeToSupportedCountry(detected.countryCode))
        const region = detected.jurisdiction ?? detected.region
        if (region && !jurisdictionManuallySet.current) {
          setJurisdiction(region)
        }
      } finally {
        if (!cancelled) setIsDetectingCountry(false)
      }
    }

    void applyGeoDetection()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (countryLoading || countryManuallySet.current) return
    setCountryCode(normalizeToSupportedCountry(detectedCountry))
  }, [detectedCountry, countryLoading])

  useEffect(() => {
    if (countryLoading || !detectedRegion || jurisdictionManuallySet.current) return
    const match = matchRegionToStateOption(countryCode, detectedRegion)
    if (match) setJurisdiction(match)
  }, [detectedRegion, countryLoading, countryCode])

  useEffect(() => {
    if (!countryCode || phoneCountryManuallySet.current) return
    setPhoneCountryCode(countryCode)
  }, [countryCode])

  useEffect(() => {
    if (!phoneCountryCode || countryManuallySet.current) return
    const synced = syncPhoneCountryToLegal(phoneCountryCode, locationRefs)
    if (synced.countryCode) {
      setCountryCode(synced.countryCode)
      if (synced.resetJurisdiction) setJurisdiction("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCountryCode])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const metadataError = validateSignUpMetadata(
      { accountType, practiceType, firmName, countryCode },
      {
        confirmCountry: t("confirmCountryBeforeAccount"),
        firmNameRequired: t("firmNameRequired"),
      },
    )
    if (metadataError) {
      onError(metadataError)
      return
    }

    const phoneResult = resolveSignUpPhone(phoneCountryCode, phoneNational)
    if ("error" in phoneResult) {
      const message =
        phoneResult.error === "required" ? t("phoneRequired") : t("invalidPhone")
      setPhoneError(message)
      onError(message)
      return
    }
    setPhoneError(null)

    try {
      setIsSubmitting(true)
      const resolvedFirmName = resolveFirmName(
        { accountType, practiceType, firmName, name },
        t("myPractice"),
      )
      const resolvedReferral = resolveReferralCode(referralCode ?? null) ?? undefined
      const deviceFingerprint = getDeviceId() ?? undefined

      if (accountType === "LAWYER") {
        setSoloIntent(practiceType === "SOLO")
      }

      const idToken = await getFirebaseIdToken()
      const response = await loginWithFirebase({
        idToken,
        userType: accountType,
        countryCode,
        jurisdiction: jurisdiction.trim() || undefined,
        name: name.trim() || undefined,
        firmName: resolvedFirmName,
        phone: phoneResult.phone,
        referralCode: resolvedReferral,
        deviceFingerprint,
      })

      if (accountType === "LAWYER") {
        trackLawyerSignup({
          countryCode,
          firmName: resolvedFirmName,
          authProvider: "firebase",
        })
      }

      clearPersistedReferralCode()
      onComplete(response)
    } catch (err) {
      onError(err instanceof Error ? err.message : t("unableToCreateAccount"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {prospectPrefillHint && (
        <div className="p-3 text-sm text-muted-foreground bg-muted/50 rounded-md border border-border">
          {t("prospectPrefillHint")}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="oauth-email">{t("email")}</Label>
        <Input id="oauth-email" type="email" value={email} readOnly disabled className="bg-muted" />
      </div>

      <div className="space-y-2 pb-1">
        <Label htmlFor="oauth-phone">{t("phone")}</Label>
        <PhoneInput
          id="oauth-phone"
          countryCode={phoneCountryCode || countryCode || "US"}
          nationalNumber={phoneNational}
          onCountryCodeChange={(value) => {
            phoneCountryManuallySet.current = true
            setPhoneCountryCode(value)
            const synced = syncPhoneCountryToLegal(value, locationRefs)
            if (synced.countryCode) {
              setCountryCode(synced.countryCode)
              if (synced.resetJurisdiction) setJurisdiction("")
            }
            setPhoneError(null)
          }}
          onNationalNumberChange={(value) => {
            setPhoneNational(value)
            setPhoneError(null)
          }}
        />
        {phoneError ? (
          <p className="text-sm text-destructive">{phoneError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="oauth-name">{t("fullNameOptional")}</Label>
        <Input
          id="oauth-name"
          placeholder={t("fullNamePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("accountType")}</Label>
        <Select
          value={accountType}
          onValueChange={(value) => setAccountType(value as AccountType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CONSUMER">{t("consumerOption")}</SelectItem>
            <SelectItem value="LAWYER">{t("lawyerOption")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {accountType === "LAWYER" && (
        <div className="space-y-2">
          <Label>{t("howDoYouPractice")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPracticeType("SOLO")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                practiceType === "SOLO"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-medium">{t("justMe")}</span>
              <span className="block text-xs text-muted-foreground">{t("soloIndependent")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPracticeType("FIRM")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                practiceType === "FIRM"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-medium">{t("lawFirm")}</span>
              <span className="block text-xs text-muted-foreground">{t("teamOfLawyers")}</span>
            </button>
          </div>
        </div>
      )}

      {accountType === "LAWYER" && practiceType === "FIRM" && (
        <div className="space-y-2">
          <Label htmlFor="oauth-firmName">{t("firmName")}</Label>
          <Input
            id="oauth-firmName"
            placeholder={t("firmNamePlaceholder")}
            value={firmName}
            onChange={(event) => setFirmName(event.target.value)}
          />
        </div>
      )}

      {accountType === "LAWYER" && practiceType === "SOLO" && (
        <div className="space-y-2">
          <Label htmlFor="oauth-practiceName">{t("practiceNameOptional")}</Label>
          <Input
            id="oauth-practiceName"
            placeholder={t("defaultsToYourName")}
            value={firmName}
            onChange={(event) => setFirmName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("soloWorkspaceHint")}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("countryJurisdiction")}</Label>
        <CountryConfirmStep
          countryCode={countryCode}
          jurisdiction={jurisdiction}
          isDetecting={countryLoading || isDetectingCountry}
          countryHelperText={
            phoneCountryCode && countryCode && phoneCountryCode === countryCode
              ? t("countrySyncedFromPhone")
              : undefined
          }
          onCountryChange={(value) => {
            countryManuallySet.current = true
            jurisdictionManuallySet.current = true
            setCountryCode(value)
            setJurisdiction("")
            const phoneSync = syncLegalCountryToPhone(value, locationRefs)
            if (phoneSync) setPhoneCountryCode(phoneSync)
          }}
          onJurisdictionChange={(value) => {
            jurisdictionManuallySet.current = true
            setJurisdiction(value)
          }}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("creatingAccount") : t("completeSignUp")}
      </Button>
    </form>
  )
}
