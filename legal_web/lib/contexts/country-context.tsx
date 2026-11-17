"use client"
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { CountryCode } from "@/lib/api/types"
import { getMyProfile, type EffectiveLegalLocation, type UserProfile } from "@/lib/api/profile"
import {
  detectCountry,
  detectIpLocation,
  getCountryName,
  getStoredCountryIfConfirmed,
  normalizeToSupportedCountry,
  persistCountrySelection,
  resolveWorkspaceCountryCode,
  type DetectedCountry,
} from "@/lib/geo/detect-country"
import {
  hasJurisdictionMismatch,
  type JurisdictionLocation,
} from "@/lib/geo/jurisdiction-mismatch"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenantOptional } from "@/lib/contexts/tenant-context"

interface CountryContextType {
  countryCode: CountryCode
  countryName: string
  /** Profile or IP-detected region / state name applied to the active country. */
  detectedRegion: string | null
  detectionSource: DetectedCountry["source"] | EffectiveLegalLocation["source"] | null
  isLoading: boolean
  /** Signed-in profile / tenant country when available. */
  profileCountryCode: CountryCode | null
  profileRegion: string | null
  /** Raw IP geo (may differ from profile). */
  ipCountryCode: CountryCode | null
  ipRegion: string | null
  /** True when profile and IP disagree on country or known region. */
  hasJurisdictionMismatch: boolean
  setCountryCode: (code: CountryCode, opts?: { persistProfile?: boolean }) => void
  refreshDetection: () => Promise<void>
  workspaceCountryOverride: CountryCode | null
  selectWorkspaceCountry: (code: CountryCode | null) => void
}

const CountryContext = createContext<CountryContextType | undefined>(undefined)

const WORKSPACE_FALLBACK_COUNTRY = "IN"

function effectiveWorkspaceCountry(
  profile: UserProfile | { countryCode?: string | null },
  tenantPrimaryCountry?: string | null,
): string {
  return resolveWorkspaceCountryCode({
    tenantPrimary: tenantPrimaryCountry,
    profile:
      ("legalLocation" in profile
        ? profile.countryCode || profile.legalLocation?.countryCode
        : profile.countryCode) ?? null,
  })
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const { activeTenant } = useTenantOptional()
  const [countryCode, setCountryCodeState] = useState<CountryCode>("")
  const [countryName, setCountryName] = useState("")
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null)
  const [detectionSource, setDetectionSource] = useState<
    CountryContextType["detectionSource"]
  >(null)
  const [profileCountryCode, setProfileCountryCode] = useState<CountryCode | null>(null)
  const [profileRegion, setProfileRegion] = useState<string | null>(null)
  const [ipCountryCode, setIpCountryCode] = useState<CountryCode | null>(null)
  const [ipRegion, setIpRegion] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const sessionOverrideRef = useRef(false)
  const detectionRun = useRef(0)
  const lastAccountKey = useRef<string | null>(null)
  const storageKey = user?.id ? `umbrella-workspace-country:${user.id}` : null
  const [workspaceCountryOverride, setWorkspaceCountryOverride] = useState<CountryCode | null>(null)

  const applyDetection = useCallback(async () => {
    if (sessionOverrideRef.current) return
    const run = ++detectionRun.current
    const isCurrent = () => run === detectionRun.current && !sessionOverrideRef.current
    setIsLoading(true)
    try {
      let manualCountry = ""
      try {
        manualCountry = normalizeToSupportedCountry(storageKey ? localStorage.getItem(storageKey) : null)
      } catch { /* Browser storage is optional. */ }
      setWorkspaceCountryOverride(manualCountry || null)
      if (isAuthenticated && user) {
        let nextProfileCountry = ""
        let nextProfileRegion: string | null = null
        let profileSource: CountryContextType["detectionSource"] = "stored"

        try {
          const profile = await getMyProfile()
          if (!isCurrent()) return

          nextProfileCountry = effectiveWorkspaceCountry(
            profile,
            activeTenant?.tenant.primaryCountry,
          )
          nextProfileRegion = profile.jurisdiction ?? profile.legalLocation?.jurisdiction ?? null
          profileSource = profile.legalLocation?.source ?? "stored"
        } catch {
          nextProfileCountry =
            effectiveWorkspaceCountry(
              { countryCode: user.countryCode },
              activeTenant?.tenant.primaryCountry,
            ) || ""
        }

        const ipLocation = await detectIpLocation()
        if (!isCurrent()) return

        const activeCountry = manualCountry || resolveWorkspaceCountryCode({
          confirmedOverride: getStoredCountryIfConfirmed(),
          currentLocation: ipLocation?.countryCode,
          profile: nextProfileCountry,
          tenantPrimary: activeTenant?.tenant.primaryCountry,
        }) || WORKSPACE_FALLBACK_COUNTRY

        const nextIpCountry = (ipLocation?.countryCode as CountryCode | null) ?? null
        const nextIpRegion = ipLocation?.region ?? null

        setProfileCountryCode((nextProfileCountry as CountryCode) || null)
        setProfileRegion(nextProfileRegion)
        setIpCountryCode(nextIpCountry)
        setIpRegion(nextIpRegion)

        if (activeCountry) {
          const sameCountryIpRegion =
            nextIpCountry &&
            nextIpCountry.toUpperCase() === activeCountry.toUpperCase()
              ? nextIpRegion
              : null

          setCountryCodeState(activeCountry as CountryCode)
          setCountryName(getCountryName(activeCountry))
          setDetectedRegion(sameCountryIpRegion || (activeCountry === nextProfileCountry ? nextProfileRegion : null))
          setDetectionSource(
            manualCountry ? "stored" : nextIpCountry === activeCountry ? "ip"
              : getStoredCountryIfConfirmed() ? "stored"
              : nextProfileCountry ? profileSource : "default",
          )
        }
        return
      }

      setProfileCountryCode(null)
      setProfileRegion(null)

      const detected = await detectCountry({ preferStored: false })
      if (!isCurrent()) return

      const detectedCountry = normalizeToSupportedCountry(detected.countryCode)
      const detectedIpRegion = detected.jurisdiction ?? detected.region ?? null

      setIpCountryCode((detectedCountry as CountryCode) || null)
      setIpRegion(detectedIpRegion)

      if (detectedCountry) {
        setCountryCodeState(detectedCountry as CountryCode)
        setCountryName(getCountryName(detectedCountry))
        setDetectedRegion(detectedIpRegion)
        setDetectionSource(detected.source)
      }
    } finally {
      if (isCurrent()) setIsLoading(false)
    }
  }, [isAuthenticated, user, activeTenant?.tenant.primaryCountry, storageKey])

  useEffect(() => {
    if (lastAccountKey.current !== storageKey) {
      lastAccountKey.current = storageKey
      sessionOverrideRef.current = false
    }
    void applyDetection()
    const activeDetection = detectionRun
    return () => { activeDetection.current++ }
  }, [applyDetection, storageKey])

  const setCountryCode = useCallback((code: CountryCode, opts?: { persistProfile?: boolean }) => {
    sessionOverrideRef.current = true
    if (opts?.persistProfile) {
      persistCountrySelection(code, { userConfirmed: true })
    }
    const name = getCountryName(code)
    setCountryCodeState(code)
    setCountryName(name)
    setDetectedRegion(null)
    setDetectionSource("stored")
    setIsLoading(false)
  }, [])

  const refreshDetection = useCallback(async () => {
    sessionOverrideRef.current = false
    await applyDetection()
  }, [applyDetection])

  const selectWorkspaceCountry = useCallback((code: CountryCode | null) => {
    const selection = normalizeToSupportedCountry(code) || null
    try {
      if (storageKey) {
        if (selection) localStorage.setItem(storageKey, selection)
        else localStorage.removeItem(storageKey)
      }
    } catch { /* The choice still applies in the current tab. */ }
    setWorkspaceCountryOverride(selection)
    if (selection) setCountryCode(selection)
    else void refreshDetection()
  }, [storageKey, setCountryCode, refreshDetection])

  const profileLocation: JurisdictionLocation | null = profileCountryCode
    ? { countryCode: profileCountryCode, region: profileRegion }
    : null
  const ipLocation: JurisdictionLocation | null = ipCountryCode
    ? { countryCode: ipCountryCode, region: ipRegion }
    : null

  return (
    <CountryContext.Provider
      value={{
        countryCode,
        countryName,
        detectedRegion,
        detectionSource,
        isLoading,
        profileCountryCode,
        profileRegion,
        ipCountryCode,
        ipRegion,
        hasJurisdictionMismatch: hasJurisdictionMismatch(profileLocation, ipLocation),
        setCountryCode,
        refreshDetection,
        workspaceCountryOverride,
        selectWorkspaceCountry,
      }}
    >
      {children}
    </CountryContext.Provider>
  )
}

export function useDetectedCountry() {
  const context = useContext(CountryContext)
  if (context === undefined) {
    throw new Error("useDetectedCountry must be used within a CountryProvider")
  }
  return context
}
