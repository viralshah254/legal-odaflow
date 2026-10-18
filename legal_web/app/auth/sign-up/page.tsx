"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { normalizeToSupportedCountry } from "@/lib/geo/detect-country"
import { matchRegionToStateOption } from "@/lib/geo/country-states"
import { useDefaultPhoneCountry } from "@/lib/hooks/use-default-phone-country"
import {
  getFirebaseAuthErrorMessage,
  isFirebaseAuthUnavailable,
} from "@/lib/firebase-errors"
import {
  getFirebaseIdToken,
  shouldUseFirebaseAuth,
  signUpWithEmail,
} from "@/lib/firebase"
import { AuthShell } from "@/components/auth/auth-shell"
import {
  clearPersistedReferralCode,
  persistReferralCode,
  resolveReferralCode,
} from "@/lib/auth/referral-storage"
import {
  resolveFirmName,
  validateSignUpMetadata,
  type AccountType,
} from "@/lib/auth/sign-up-metadata"
import { redirectAfterAuth } from "@/lib/auth/redirect-after-auth"
import { CountryConfirmStep } from "@/components/issue-checker/country-confirm-step"
import { trackLawyerSignup } from "@/lib/analytics/posthog"
import { identifyVisitor } from "@/lib/analytics/site-analytics"
import { getDeviceId } from "@/lib/device/device-id"
import { setSoloIntent } from "@/lib/hooks/use-is-solo"
import { getReferralPreview, type ReferralPreview } from "@/lib/api/referrals"
import { PasswordField } from "@/components/auth/password-field"
import {
  firstPasswordErrorMessage,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy"
import { PhoneInput } from "@/components/ui/phone-input"
import { resolveSignUpPhone } from "@/lib/auth/sign-up-phone"
import {
  syncLegalCountryToPhone,
  syncPhoneCountryToLegal,
  type LocationSyncRefs,
} from "@/lib/auth/sign-up-location-sync"
import { lookupAuthEmail } from "@/lib/api/auth"
import {
  buildSignInUrl,
  resolveSignUpEmailGuard,
} from "@/lib/auth/sign-up-email-guard"
import { applyProspectPrefill } from "@/lib/auth/sign-up-prospect-prefill"
import {
  isConnectionError,
  isDuplicateEmailError,
} from "@/lib/auth/duplicate-email-error"
import { Check, LifeBuoy, Scale, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type AccountPath = "individual" | "lawFirm"
type IndividualRole = "client" | "lawyer"

const profileSchema = (t: (key: string) => string) =>
  z
    .object({
      firmName: z.string().optional(),
      name: z.string().optional(),
      countryCode: z.string().min(2),
      jurisdiction: z.string().optional(),
      email: z.string().email(t("invalidEmail")),
      password: z
        .string()
        .min(PASSWORD_MIN_LENGTH, t("passwordTooShort"))
        .max(PASSWORD_MAX_LENGTH, t("passwordTooLong")),
      confirmPassword: z.string(),
    })
    .superRefine((data, ctx) => {
      const result = validatePasswordPolicy(data.password, {
        email: data.email,
        name: data.name,
        firmName: data.firmName,
      })
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: firstPasswordErrorMessage(result, t),
          path: ["password"],
        })
      }
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordsDontMatch"),
      path: ["confirmPassword"],
    })

type ProfileForm = z.infer<ReturnType<typeof profileSchema>>

const firebaseReady = shouldUseFirebaseAuth()
const TOTAL_STEPS = 2

const SIGN_UP_STEP_LABELS = ["signUpStepWorkspace", "signUpStepAccount"] as const

function SignUpProgress({
  step,
  total,
  stepLabelKey,
  t,
}: {
  step: number
  total: number
  stepLabelKey: (typeof SIGN_UP_STEP_LABELS)[number]
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <div
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              index < step ? "bg-primary" : index === step ? "bg-primary/70" : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("stepOf", { current: step + 1, total })} · {t(stepLabelKey)}
      </p>
    </div>
  )
}

function WorkspaceChoiceCard({
  selected,
  title,
  body,
  onClick,
}: {
  selected: boolean
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground mt-1">{body}</span>
    </button>
  )
}

function ProfileChoiceCard({
  selected,
  title,
  body,
  perks,
  icon: Icon,
  recommended,
  recommendedLabel,
  variant,
  onClick,
}: {
  selected: boolean
  title: string
  body: string
  perks: [string, string]
  icon: LucideIcon
  recommended?: boolean
  recommendedLabel?: string
  variant: "lawyer" | "client"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg border p-3 text-left transition-colors overflow-hidden",
        selected && variant === "lawyer" && "border-primary bg-primary/5 ring-1 ring-primary/30",
        selected && variant === "client" && "border-border bg-muted/30 ring-1 ring-border",
        !selected && "border-border hover:border-primary/40",
      )}
    >
      {selected && variant === "lawyer" && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-primary rounded-l-lg"
        />
      )}
      <div className="flex items-start gap-3 pl-1">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            selected && variant === "lawyer" && "bg-primary/15 text-primary",
            selected && variant === "client" && "bg-muted text-muted-foreground",
            !selected && "bg-muted/60 text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            {recommended && recommendedLabel && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {recommendedLabel}
              </span>
            )}
          </div>
          <span className="block text-xs text-muted-foreground">{body}</span>
          <ul className="space-y-1">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-2.5 w-2.5" aria-hidden />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  )
}

function SignUpForm() {
  const t = useTranslations("auth")
  const tc = useTranslations("common")
  const tErrors = useTranslations("errors")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect")
  const refCode = searchParams.get("ref")
  const initialEmail = searchParams.get("email")?.trim() ?? ""
  const { register: registerUser, loginWithFirebase } = useAuth()
  const {
    countryCode: detectedCountry,
    detectedRegion,
    isLoading: countryLoading,
    detectionSource,
  } = useDetectedCountry()
  const { countryCode: defaultPhoneCountry } = useDefaultPhoneCountry()

  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [referralPreview, setReferralPreview] = useState<ReferralPreview | null>(null)
  const [accountPath, setAccountPath] = useState<AccountPath>("individual")
  const [individualRole, setIndividualRole] = useState<IndividualRole>("lawyer")
  const countryManuallySet = useRef(false)
  const jurisdictionManuallySet = useRef(false)
  const phoneCountryManuallySet = useRef(false)
  const [phoneCountryCode, setPhoneCountryCode] = useState("")
  const [phoneNational, setPhoneNational] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneCountrySynced, setPhoneCountrySynced] = useState(false)
  const [emailLookupWarning, setEmailLookupWarning] = useState<string | null>(null)
  const [prospectPrefillHint, setProspectPrefillHint] = useState(false)
  const [socialOnlyBlocked, setSocialOnlyBlocked] = useState(false)
  const [showSignInRecovery, setShowSignInRecovery] = useState(false)
  const [showRetryRecovery, setShowRetryRecovery] = useState(false)
  const [lastSubmitData, setLastSubmitData] = useState<ProfileForm | null>(null)
  const emailGuardChecked = useRef(false)
  const lastPrefilledEmail = useRef("")

  const locationRefs: LocationSyncRefs = {
    countryManuallySet,
    jurisdictionManuallySet,
    phoneCountryManuallySet,
  }

  const isLawyer =
    accountPath === "lawFirm" || individualRole === "lawyer"
  const accountType: AccountType = isLawyer ? "LAWYER" : "CONSUMER"
  const practiceType = accountPath === "lawFirm" ? "FIRM" : "SOLO"
  const emailLocked = initialEmail.length > 0

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema(t)),
    defaultValues: {
      email: initialEmail,
      countryCode: "",
      jurisdiction: "",
    },
  })

  const countryCode = watch("countryCode")
  const jurisdiction = watch("jurisdiction")
  const emailValue = watch("email")
  const nameValue = watch("name")
  const firmNameValue = watch("firmName")
  const passwordContext = {
    email: emailValue,
    name: nameValue,
    firmName: firmNameValue,
  }

  const resolvedRefCode = resolveReferralCode(refCode)

  const signInRecoveryUrl = buildSignInUrl({
    email: emailValue?.trim() || initialEmail,
    redirectTo,
    refCode,
  })

  const runEmailGuard = async (email: string, options?: { redirect?: boolean }) => {
    const trimmed = email.trim()
    if (!trimmed) return "allow" as const

    try {
      const lookup = await lookupAuthEmail(trimmed)
      const action = resolveSignUpEmailGuard({ lookup })
      if (action === "redirect_sign_in" && options?.redirect !== false) {
        router.replace(
          buildSignInUrl({ email: trimmed, redirectTo, refCode }),
        )
        return action
      }
      if (action === "social_only") {
        setSocialOnlyBlocked(true)
        setError(t("accountUsesSocial"))
        setShowSignInRecovery(true)
        return action
      }

      if (
        lookup.prospectPrefill &&
        !lookup.exists &&
        lastPrefilledEmail.current !== trimmed.toLowerCase()
      ) {
        applyProspectPrefill({
          prefill: lookup.prospectPrefill,
          setValue,
          setAccountPath,
          setIndividualRole,
          setPhoneCountryCode,
          setPhoneNational,
          locationRefs,
          currentValues: {
            name: nameValue,
            firmName: firmNameValue,
            jurisdiction,
            countryCode,
            phoneNational,
          },
        })
        lastPrefilledEmail.current = trimmed.toLowerCase()
        setProspectPrefillHint(true)
      }

      return action
    } catch {
      setEmailLookupWarning(t("emailLookupUnavailable"))
      return "lookup_unavailable" as const
    }
  }

  useEffect(() => {
    const email = initialEmail.trim()
    if (!email || emailGuardChecked.current) return
    emailGuardChecked.current = true
    void runEmailGuard(email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail])

  useEffect(() => {
    if (countryLoading || countryManuallySet.current) return

    const normalized = normalizeToSupportedCountry(detectedCountry)
    if (normalized) {
      setValue("countryCode", normalized)
      if (!phoneCountryManuallySet.current) {
        setPhoneCountryCode(normalized)
      }
    }

    if (
      detectedRegion &&
      !jurisdictionManuallySet.current &&
      normalized &&
      detectionSource === "ip"
    ) {
      const matched = matchRegionToStateOption(normalized, detectedRegion)
      if (matched) setValue("jurisdiction", matched)
    }
  }, [
    countryLoading,
    detectedCountry,
    detectedRegion,
    detectionSource,
    setValue,
  ])

  useEffect(() => {
    if (phoneCountryManuallySet.current || phoneCountryCode) return
    const fallback = normalizeToSupportedCountry(
      defaultPhoneCountry || detectedCountry,
    )
    if (fallback) setPhoneCountryCode(fallback)
  }, [defaultPhoneCountry, detectedCountry, phoneCountryCode])

  useEffect(() => {
    if (!countryCode || phoneCountryManuallySet.current) return
    setPhoneCountryCode(countryCode)
  }, [countryCode])

  useEffect(() => {
    if (!phoneCountryCode || countryManuallySet.current || !phoneCountryManuallySet.current) {
      return
    }
    const synced = syncPhoneCountryToLegal(phoneCountryCode, locationRefs)
    if (synced.countryCode) {
      setValue("countryCode", synced.countryCode)
      if (synced.resetJurisdiction) setValue("jurisdiction", "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCountryCode])

  useEffect(() => {
    persistReferralCode(refCode)
    const codeToPreview = resolvedRefCode
    if (!codeToPreview) return
    getReferralPreview(codeToPreview)
      .then((result) => {
        if (result.valid) setReferralPreview(result)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCode])

  const onSubmit = async (data: ProfileForm) => {
    try {
      setError(null)
      setShowSignInRecovery(false)
      setShowRetryRecovery(false)
      setLastSubmitData(data)

      try {
        const lookup = await lookupAuthEmail(data.email)
        const guardAction = resolveSignUpEmailGuard({ lookup })
        if (guardAction === "redirect_sign_in") {
          setError(tErrors("emailAlreadyInUse"))
          setShowSignInRecovery(true)
          return
        }
        if (guardAction === "social_only") {
          setSocialOnlyBlocked(true)
          setError(t("accountUsesSocial"))
          setShowSignInRecovery(true)
          return
        }
      } catch {
        // Lookup is best-effort; Firebase/backend still reject duplicates.
      }

      const metadataError = validateSignUpMetadata(
        {
          accountType,
          practiceType,
          firmName: data.firmName,
          countryCode: data.countryCode,
        },
        {
          confirmCountry: t("confirmCountryBeforeAccount"),
          firmNameRequired: t("firmNameRequired"),
        },
      )
      if (metadataError) {
        setError(metadataError)
        return
      }

      const phoneResult = resolveSignUpPhone(phoneCountryCode, phoneNational)
      if ("error" in phoneResult) {
        const message =
          phoneResult.error === "required" ? t("phoneRequired") : t("invalidPhone")
        setPhoneError(message)
        setError(message)
        return
      }
      setPhoneError(null)

      const deviceFingerprint = getDeviceId()
      const resolvedFirmName = resolveFirmName(
        {
          accountType,
          practiceType,
          firmName: data.firmName,
          name: data.name,
        },
        t("myPractice"),
      )

      if (accountType === "LAWYER") {
        setSoloIntent(practiceType === "SOLO")
      }

      const registerPayload = {
        email: data.email,
        password: data.password,
        phone: phoneResult.phone,
        userType: accountType,
        countryCode: data.countryCode,
        jurisdiction: data.jurisdiction?.trim() || undefined,
        name: data.name,
        firmName: resolvedFirmName,
        referralCode: resolvedRefCode ?? undefined,
        deviceFingerprint: deviceFingerprint ?? undefined,
      }

      let response
      if (firebaseReady) {
        try {
          await signUpWithEmail(data.email, data.password)
          const idToken = await getFirebaseIdToken()
          response = await loginWithFirebase({
            idToken,
            userType: accountType,
            countryCode: data.countryCode,
            jurisdiction: data.jurisdiction?.trim() || undefined,
            name: data.name,
            firmName: resolvedFirmName,
            phone: phoneResult.phone,
            referralCode: resolvedRefCode ?? undefined,
            deviceFingerprint: deviceFingerprint ?? undefined,
          })
        } catch (firebaseError) {
          if (isFirebaseAuthUnavailable(firebaseError)) {
            response = await registerUser(registerPayload)
          } else {
            throw firebaseError
          }
        }
      } else {
        response = await registerUser(registerPayload)
      }

      if (accountType === "LAWYER") {
        trackLawyerSignup({
          countryCode: data.countryCode,
          firmName: resolvedFirmName,
          authProvider: firebaseReady ? "firebase" : "api",
        })
      }

      identifyVisitor(response.user.id)
      clearPersistedReferralCode()
      redirectAfterAuth(response.user, router, redirectTo)
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err, tErrors)
      setError(message)
      if (isDuplicateEmailError(err)) {
        setShowSignInRecovery(true)
        setShowRetryRecovery(false)
      } else if (isConnectionError(err)) {
        setShowSignInRecovery(true)
        setShowRetryRecovery(true)
      }
    }
  }

  const retrySubmit = () => {
    if (lastSubmitData) {
      void onSubmit(lastSubmitData)
    }
  }

  const goBack = () => {
    if (step === 0) {
      router.push("/auth")
      return
    }
    setStep(0)
    setError(null)
  }

  const continueFromWorkspace = async () => {
    const email = emailValue?.trim()
    if (email && !emailLocked) {
      const action = await runEmailGuard(email, { redirect: true })
      if (action === "redirect_sign_in" || action === "social_only") {
        return
      }
    }
    setStep(1)
    setError(null)
  }

  const pathSummaryLabel =
    accountPath === "lawFirm"
      ? t("pathSummaryLawFirm")
      : individualRole === "lawyer"
        ? t("pathSummarySoloLawyer")
        : t("pathSummaryLegalHelp")

  return (
    <AuthShell>
      <CardHeader className="space-y-1 text-center pb-2">
        <CardTitle className="text-2xl">
          {step === 0 ? t("createYourProfile") : t("signUpAccountTitle")}
        </CardTitle>
        <CardDescription>
          {step === 0 ? t("chooseWorkspace") : t("signUpAccountDescription")}
        </CardDescription>
        <SignUpProgress
          step={step}
          total={TOTAL_STEPS}
          stepLabelKey={SIGN_UP_STEP_LABELS[step]}
          t={t}
        />
      </CardHeader>
      <CardContent>
        {emailLookupWarning && (
          <div className="p-3 mb-4 text-sm text-muted-foreground bg-muted/50 rounded-md border border-border">
            {emailLookupWarning}
          </div>
        )}

        {prospectPrefillHint && (
          <div className="p-3 mb-4 text-sm text-muted-foreground bg-muted/50 rounded-md border border-border">
            {t("prospectPrefillHint")}
          </div>
        )}

        {socialOnlyBlocked && (
          <div className="p-3 mb-4 text-sm text-muted-foreground bg-muted/50 rounded-md border border-border">
            {t("accountUsesSocial")}
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">
            <p>{error}</p>
            {(showSignInRecovery || showRetryRecovery) && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {showSignInRecovery && (
                  <Link href={signInRecoveryUrl} className="text-primary hover:underline font-medium">
                    {t("signInInstead")}
                  </Link>
                )}
                {showRetryRecovery && (
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={retrySubmit}
                    disabled={isSubmitting}
                  >
                    {t("tryAgain")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {resolvedRefCode && (
          <div className="p-3 mb-4 text-sm bg-primary/10 text-primary rounded-md border border-primary/20">
            {referralPreview
              ? t.rich("refInviteBanner", {
                  name: referralPreview.referrerDisplayName,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })
              : t("refInviteBannerGeneric")}
          </div>
        )}

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("howWillYouUse")}</Label>
              <div className="grid gap-2">
                <WorkspaceChoiceCard
                  selected={accountPath === "individual"}
                  title={t("accountIndividual")}
                  body={t("accountIndividualBody")}
                  onClick={() => setAccountPath("individual")}
                />
                <WorkspaceChoiceCard
                  selected={accountPath === "lawFirm"}
                  title={t("accountLawFirm")}
                  body={t("accountLawFirmBody")}
                  onClick={() => setAccountPath("lawFirm")}
                />
              </div>
            </div>

            {accountPath === "individual" && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <Label>{t("whichProfile")}</Label>
                  <p className="text-xs text-muted-foreground">{t("whichProfileSubtitle")}</p>
                </div>
                <div className="grid gap-2">
                  <ProfileChoiceCard
                    selected={individualRole === "lawyer"}
                    title={t("iAmLawyer")}
                    body={t("iAmLawyerBody")}
                    perks={[t("lawyerPerk1"), t("lawyerPerk2")]}
                    icon={Scale}
                    recommended
                    recommendedLabel={t("mostCommon")}
                    variant="lawyer"
                    onClick={() => setIndividualRole("lawyer")}
                  />
                  <ProfileChoiceCard
                    selected={individualRole === "client"}
                    title={t("needLegalHelp")}
                    body={t("needLegalHelpBody")}
                    perks={[t("clientPerk1"), t("clientPerk2")]}
                    icon={LifeBuoy}
                    variant="client"
                    onClick={() => setIndividualRole("client")}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={goBack}>
                {tc("back")}
              </Button>
              <Button type="button" className="flex-1" onClick={continueFromWorkspace}>
                {tc("continue")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
              <div className="flex justify-center">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {pathSummaryLabel}
                </span>
              </div>

            {accountPath === "lawFirm" && (
              <div className="space-y-2">
                <Label htmlFor="firmName">{t("firmName")}</Label>
                <Input
                  id="firmName"
                  placeholder={t("firmNamePlaceholder")}
                  {...register("firmName")}
                />
                {errors.firmName && (
                  <p className="text-sm text-destructive">{errors.firmName.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("fullNameOptional")}</Label>
              <Input id="name" placeholder={t("fullNamePlaceholder")} {...register("name")} />
            </div>

            <div className="space-y-2">
              <Label>{t("countryJurisdiction")}</Label>
              <CountryConfirmStep
                countryCode={countryCode}
                jurisdiction={jurisdiction ?? ""}
                isDetecting={countryLoading}
                countryHelperText={
                  phoneCountrySynced &&
                  phoneCountryCode &&
                  countryCode &&
                  phoneCountryCode === countryCode
                    ? t("countrySyncedFromPhone")
                    : undefined
                }
                onCountryChange={(value) => {
                  countryManuallySet.current = true
                  jurisdictionManuallySet.current = true
                  setValue("countryCode", value)
                  setValue("jurisdiction", "")
                  const phoneSync = syncLegalCountryToPhone(value, locationRefs)
                  if (phoneSync) setPhoneCountryCode(phoneSync)
                }}
                onJurisdictionChange={(value) => {
                  jurisdictionManuallySet.current = true
                  setValue("jurisdiction", value)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                readOnly={emailLocked}
                disabled={emailLocked}
                className={emailLocked ? "bg-muted" : undefined}
                {...register("email", {
                  onBlur: (event) => {
                    void runEmailGuard(event.target.value, { redirect: false })
                  },
                })}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2 pb-1">
              <Label htmlFor="phone">{t("phone")}</Label>
              <PhoneInput
                id="phone"
                countryCode={
                  phoneCountryCode || countryCode || defaultPhoneCountry || "US"
                }
                preferredCountryCode={defaultPhoneCountry || countryCode}
                nationalNumber={phoneNational}
                onCountryCodeChange={(value) => {
                  phoneCountryManuallySet.current = true
                  setPhoneCountrySynced(true)
                  setPhoneCountryCode(value)
                  const synced = syncPhoneCountryToLegal(value, locationRefs)
                  if (synced.countryCode) {
                    setValue("countryCode", synced.countryCode)
                    if (synced.resetJurisdiction) setValue("jurisdiction", "")
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

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="password"
                  label={t("password")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.password?.message}
                  context={passwordContext}
                />
              )}
            />
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="confirmPassword"
                  label={t("confirmPassword")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.confirmPassword?.message}
                  context={passwordContext}
                  showStrength={false}
                />
              )}
            />

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting}>
                {tc("back")}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || socialOnlyBlocked}
              >
                {isSubmitting ? t("creatingAccount") : t("createAccount")}
              </Button>
            </div>
            </div>

            <p className="pt-2 text-xs text-center text-muted-foreground">{t("termsAgreement")}</p>
          </form>
        )}
      </CardContent>
    </AuthShell>
  )
}

export default function SignUpPage() {
  const tc = useTranslations("common")

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">{tc("loading")}</p>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  )
}
