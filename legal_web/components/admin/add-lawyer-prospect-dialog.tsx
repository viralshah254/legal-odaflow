"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PhoneInput } from "@/components/ui/phone-input"
import { CountryConfirmStep } from "@/components/issue-checker/country-confirm-step"
import { SearchableCitySelect } from "@/components/admin/searchable-city-select"
import { createLawyerProspect } from "@/lib/api/admin"
import type { CountryCode } from "@/lib/api/types"
import { formatPersonName } from "@/lib/format-person-name"
import {
  DEFAULT_PROSPECT_CITY,
  DEFAULT_PROSPECT_COUNTRY_CODE,
  DEFAULT_PROSPECT_STATE,
  resolveDefaultCity,
} from "@/lib/geo/country-cities"
import { getStateOptions, isAllRegionsSelection } from "@/lib/geo/country-states"
import { validateSignUpMetadata, type PracticeType } from "@/lib/auth/sign-up-metadata"
import { resolveSignUpPhone } from "@/lib/auth/sign-up-phone"

type PracticePath = "individual" | "lawFirm"

interface AddLawyerProspectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function defaultStateForCountry(countryCode: string): string {
  const states = getStateOptions(countryCode)
  if (countryCode === DEFAULT_PROSPECT_COUNTRY_CODE) {
    return states.includes(DEFAULT_PROSPECT_STATE) ? DEFAULT_PROSPECT_STATE : states[0] ?? ""
  }
  return states[0] ?? ""
}

export function AddLawyerProspectDialog({
  open,
  onOpenChange,
  onCreated,
}: AddLawyerProspectDialogProps) {
  const [practicePath, setPracticePath] = useState<PracticePath>("individual")
  const [fullName, setFullName] = useState("")
  const [organisation, setOrganisation] = useState("")
  const [email, setEmail] = useState("")
  const [countryCode, setCountryCode] = useState<CountryCode>(DEFAULT_PROSPECT_COUNTRY_CODE)
  const [state, setState] = useState(DEFAULT_PROSPECT_STATE)
  const [city, setCity] = useState(DEFAULT_PROSPECT_CITY)
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PROSPECT_COUNTRY_CODE)
  const [phoneNational, setPhoneNational] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const resetForm = useCallback(() => {
    setPracticePath("individual")
    setFullName("")
    setOrganisation("")
    setEmail("")
    setCountryCode(DEFAULT_PROSPECT_COUNTRY_CODE)
    setState(DEFAULT_PROSPECT_STATE)
    setCity(DEFAULT_PROSPECT_CITY)
    setPhoneCountryCode(DEFAULT_PROSPECT_COUNTRY_CODE)
    setPhoneNational("")
    setError("")
  }, [])

  useEffect(() => {
    if (!open) return
    resetForm()
  }, [open, resetForm])

  useEffect(() => {
    if (!open || !state.trim() || isAllRegionsSelection(state)) return
    setCity((current) => {
      const next = resolveDefaultCity(
        countryCode,
        state,
        countryCode === DEFAULT_PROSPECT_COUNTRY_CODE && state === DEFAULT_PROSPECT_STATE
          ? DEFAULT_PROSPECT_CITY
          : current,
      )
      return next || current
    })
  }, [open, countryCode, state])

  const handleCountryChange = (code: CountryCode) => {
    setCountryCode(code)
    setPhoneCountryCode(code)
    const nextState = defaultStateForCountry(code)
    setState(nextState)
    setCity(
      resolveDefaultCity(
        code,
        nextState,
        code === DEFAULT_PROSPECT_COUNTRY_CODE ? DEFAULT_PROSPECT_CITY : undefined,
      ),
    )
  }

  const handleStateChange = (value: string) => {
    setState(value)
    if (isAllRegionsSelection(value)) {
      setCity("")
      return
    }
    setCity(
      resolveDefaultCity(
        countryCode,
        value,
        countryCode === DEFAULT_PROSPECT_COUNTRY_CODE && value === DEFAULT_PROSPECT_STATE
          ? DEFAULT_PROSPECT_CITY
          : undefined,
      ),
    )
  }

  const handleSubmit = async () => {
    setError("")

    const formattedName = formatPersonName(fullName)
    if (formattedName.length < 2) {
      setError("Enter the lawyer's full name.")
      return
    }

    const practiceType: PracticeType = practicePath === "lawFirm" ? "FIRM" : "SOLO"
    const metadataError = validateSignUpMetadata(
      {
        accountType: "LAWYER",
        practiceType,
        firmName: organisation,
        countryCode,
      },
      {
        confirmCountry: "Select a country.",
        firmNameRequired: "Enter the name of the law firm or practice.",
      },
    )
    if (metadataError) {
      setError(metadataError)
      return
    }

    if (isAllRegionsSelection(state) || !state.trim()) {
      setError("Select a state or region.")
      return
    }

    if (!city.trim()) {
      setError("Select or enter a city.")
      return
    }

    if (!email.trim()) {
      setError("Email is required.")
      return
    }

    const phoneResult = resolveSignUpPhone(phoneCountryCode, phoneNational)
    if ("error" in phoneResult) {
      setError("Enter a valid phone number.")
      return
    }

    setSubmitting(true)
    try {
      await createLawyerProspect({
        fullName: formattedName,
        practiceType,
        organisation: practicePath === "lawFirm" ? organisation.trim() : undefined,
        phone: phoneResult.phone,
        email: email.trim(),
        countryCode,
        state: state.trim(),
        city: city.trim(),
      })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add prospect")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col overflow-hidden gap-0 p-0 sm:gap-4 sm:p-6">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-6 pr-14 sm:px-0 sm:pt-0 sm:pr-0">
          <DialogTitle>Add prospect</DialogTitle>
          <DialogDescription>
            Capture lawyer signup details for outreach. If the email already exists, the prospect
            record will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 [-webkit-overflow-scrolling:touch] sm:px-0">
          <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="prospect-full-name">Full name</Label>
            <Input
              id="prospect-full-name"
              placeholder="First name last name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setFullName((value) => formatPersonName(value))}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Working as</span>
            <div className="grid gap-2">
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="prospect-practice-path"
                  checked={practicePath === "individual"}
                  onChange={() => setPracticePath("individual")}
                  className="mt-1"
                />
                <span>Individual lawyer</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="prospect-practice-path"
                  checked={practicePath === "lawFirm"}
                  onChange={() => setPracticePath("lawFirm")}
                  className="mt-1"
                />
                <span>Working in a law firm</span>
              </label>
            </div>
          </div>

          {practicePath === "lawFirm" && (
            <div className="space-y-2">
              <Label htmlFor="prospect-organisation">Name of practice</Label>
              <Input
                id="prospect-organisation"
                placeholder="Law firm or chamber name"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prospect-phone">Phone</Label>
            <PhoneInput
              id="prospect-phone"
              countryCode={phoneCountryCode}
              preferredCountryCode={countryCode}
              nationalNumber={phoneNational}
              onCountryCodeChange={setPhoneCountryCode}
              onNationalNumberChange={setPhoneNational}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prospect-email">Email</Label>
            <Input
              id="prospect-email"
              type="email"
              placeholder="lawyer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Country and jurisdiction</Label>
            <CountryConfirmStep
              countryCode={countryCode}
              jurisdiction={state}
              onCountryChange={handleCountryChange}
              onJurisdictionChange={handleStateChange}
              compact
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prospect-city">City</Label>
            <SearchableCitySelect
              id="prospect-city"
              countryCode={countryCode}
              stateName={state}
              value={city}
              onChange={setCity}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-[hsl(var(--popover))] px-6 py-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1.5" />
            )}
            Save prospect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
