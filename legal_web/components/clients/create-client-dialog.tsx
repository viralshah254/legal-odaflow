"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { createClient as createApiClient, listClients } from "@/lib/api/clients"
import { initializeKycForClient } from "@/lib/api/kyc"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Loader2, Plus, Save, X } from "lucide-react"
import { AlertTriangle } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useDefaultPhoneCountry } from "@/lib/hooks/use-default-phone-country"
import type { ApiClient, ClientType, ContactPerson, CountryCode } from "@/lib/api/types"
import { ApiClientError } from "@/lib/api/client"
import { getCountryName, getDefaultCountryCode } from "@/lib/geo/detect-country"
import { formatPhoneNumber } from "@/lib/geo/phone-codes"
import { isFuzzyDuplicate, normalizePhone, getPhoneCountry, digitsOnly } from "@/lib/phone"

const CORPORATE_TYPES: ClientType[] = ["COMPANY", "NGO", "PARTNERSHIP"]
const CLIENT_TYPES: ClientType[] = ["INDIVIDUAL", "COMPANY", "NGO", "PARTNERSHIP"]
const COUNTRY_NAME_TO_CODE: Record<string, CountryCode> = {
  Kenya: "KE",
  India: "IN",
  "United States": "US",
  "United Kingdom": "GB",
}

interface ContactPersonForm {
  name: string
  role: string
  email: string
  phoneCountryCode: CountryCode
  phoneNational: string
}

function emptyContact(defaultCountry: CountryCode): ContactPersonForm {
  return { name: "", role: "", email: "", phoneCountryCode: defaultCountry, phoneNational: "" }
}

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: ApiClient) => void
  initialName?: string
}

export function CreateClientDialog({ open, onOpenChange, onCreated, initialName }: CreateClientDialogProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const { activeTenantId, activeTenant } = useTenant()
  const { countryCode: defaultPhoneCountry, isLoading: phoneCountryLoading } = useDefaultPhoneCountry()
  const tenantCountryCode = (activeTenant?.tenant.primaryCountry ?? "KE") as CountryCode

  const [step, setStep] = useState(1)
  const [clientType, setClientType] = useState<ClientType>("INDIVIDUAL")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [country, setCountry] = useState(getCountryName(tenantCountryCode))
  const [phoneCountryCode, setPhoneCountryCode] = useState<CountryCode>(tenantCountryCode)
  const [phoneNational, setPhoneNational] = useState("")
  const [phoneDuplicate, setPhoneDuplicate] = useState<ApiClient | null>(null)
  const [contactPeople, setContactPeople] = useState<ContactPersonForm[]>(() => [
    emptyContact(getDefaultCountryCode() as CountryCode),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [savingBasic, setSavingBasic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dupCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset form when dialog closes; prefill name when opening with initialName
  useEffect(() => {
    if (!open) {
      setStep(1)
      setClientType("INDIVIDUAL")
      setName("")
      setEmail("")
      setAddress("")
      setCountry(getCountryName(tenantCountryCode))
      setPhoneNational("")
      setPhoneDuplicate(null)
      setContactPeople([emptyContact(getDefaultCountryCode() as CountryCode)])
      setError(null)
      return
    }
    if (initialName?.trim()) {
      setName(initialName.trim())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName])

  // Apply geo-detected or profile default to phone fields once resolved
  useEffect(() => {
    if (!open || phoneCountryLoading || !defaultPhoneCountry) return
    const code = defaultPhoneCountry as CountryCode
    setPhoneCountryCode(code)
    setContactPeople((prev) =>
      prev.map((cp) =>
        !digitsOnly(cp.phoneNational) ? { ...cp, phoneCountryCode: code } : cp,
      ),
    )
  }, [defaultPhoneCountry, phoneCountryLoading, open])

  useEffect(() => {
    if (!activeTenant?.tenant.primaryCountry) return
    const code = activeTenant.tenant.primaryCountry as CountryCode
    setCountry(getCountryName(code))
  }, [activeTenant?.tenant.primaryCountry])

  // Debounced phone duplicate check
  useEffect(() => {
    const localDigits = digitsOnly(phoneNational)
    if (!activeTenantId || localDigits.length < 7) {
      setPhoneDuplicate(null)
      return
    }
    if (dupCheckRef.current) clearTimeout(dupCheckRef.current)
    dupCheckRef.current = setTimeout(async () => {
      try {
        const pc = getPhoneCountry(phoneCountryCode)
        const normalized = normalizePhone(pc.dialCode, phoneNational) ?? ""
        const all = await listClients(activeTenantId, localDigits.slice(-7))
        const match = all.find((c) => c.phone && isFuzzyDuplicate(c.phone, normalized))
        setPhoneDuplicate(match ?? null)
      } catch {
        // ignore
      }
    }, 400)
    return () => {
      if (dupCheckRef.current) clearTimeout(dupCheckRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNational, phoneCountryCode, activeTenantId])

  const isCorporate = CORPORATE_TYPES.includes(clientType)
  const canProceed = name.trim() !== ""

  const buildContactPeople = (): ContactPerson[] | undefined => {
    if (!isCorporate) return undefined
    const filled = contactPeople.filter((cp) => cp.name.trim())
    return filled.length > 0
      ? filled.map((cp) => ({
          name: cp.name.trim(),
          role: cp.role?.trim() || undefined,
          email: cp.email?.trim() || undefined,
          phone: formatPhoneNumber(cp.phoneCountryCode, cp.phoneNational) || undefined,
        }))
      : undefined
  }

  const doCreate = async (minimal: boolean) => {
    if (!activeTenantId) { setError(t("noActiveTenant")); return }
    setError(null)
    const countryCode = COUNTRY_NAME_TO_CODE[country] ?? tenantCountryCode
    try {
      const payload = minimal
        ? { name: name.trim(), type: clientType, countryCode }
        : {
            name: name.trim(),
            email: email || undefined,
            phone: formatPhoneNumber(phoneCountryCode, phoneNational) || undefined,
            type: clientType,
            countryCode,
            contactPeople: buildContactPeople(),
          }
      const newClient = await createApiClient(activeTenantId, payload)
      try {
        await initializeKycForClient(activeTenantId, newClient.id, clientType, countryCode)
      } catch {
        // ignore duplicate init
      }
      onCreated(newClient)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("failedToCreate"))
    }
  }

  const handleSaveBasic = async () => {
    setSavingBasic(true)
    await doCreate(true)
    setSavingBasic(false)
  }

  const handleSubmit = async () => {
    if (phoneDuplicate) {
      setError(t("phoneDuplicateError", { name: phoneDuplicate.name }))
      return
    }
    setSubmitting(true)
    await doCreate(false)
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("addNewClient")}</DialogTitle>
          <DialogDescription>{t("createClientProfile")}</DialogDescription>
        </DialogHeader>

        {/* Step tabs */}
        <div className="flex gap-0 rounded-lg overflow-hidden border shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              step === 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("clientDetails")}
          </button>
          <button
            type="button"
            onClick={() => canProceed && setStep(2)}
            disabled={!canProceed}
            className={`flex-1 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              step === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("contacts")}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 pr-1">
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dlg-client-type">{t("clientType")} *</Label>
                <Select value={clientType} onValueChange={(v) => setClientType(v as ClientType)}>
                  <SelectTrigger id="dlg-client-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dlg-name">{t("clientName")} *</Label>
                <Input
                  id="dlg-name"
                  autoFocus
                  placeholder={t("enterClientName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void handleSaveBasic()}
                  disabled={!canProceed || savingBasic}
                >
                  {savingBasic ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save basic & complete later
                </Button>
                <Button type="button" onClick={() => setStep(2)} disabled={!canProceed}>
                  {t("nextContacts")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dlg-email">{t("email")}</Label>
                <Input
                  id="dlg-email"
                  type="email"
                  placeholder={t("clientexamplecom")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dlg-phone">{t("phone")}</Label>
                <PhoneInput
                  id="dlg-phone"
                  countryCode={phoneCountryCode}
                  nationalNumber={phoneNational}
                  preferredCountryCode={defaultPhoneCountry}
                  onCountryCodeChange={(code) => setPhoneCountryCode(code as CountryCode)}
                  onNationalNumberChange={setPhoneNational}
                  placeholder={t("700_000_000")}
                />
                {phoneDuplicate && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                      {t("phoneDuplicateWarning", { name: phoneDuplicate.name })}{" "}
                      <a
                        href={`/app/clients/${phoneDuplicate.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-medium"
                      >
                        {t("viewExistingClient")}
                      </a>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dlg-address">{t("address")}</Label>
                <Input
                  id="dlg-address"
                  placeholder={t("streetAddress")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dlg-country">{tc("country")}</Label>
                <Input
                  id="dlg-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>

              {isCorporate && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Contact people</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setContactPeople((prev) => [...prev, emptyContact(defaultPhoneCountry as CountryCode)])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add contact
                    </Button>
                  </div>
                  {contactPeople.map((cp, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Contact {idx + 1}
                        </span>
                        {contactPeople.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setContactPeople((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove contact"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name *</Label>
                          <Input
                            placeholder="Full name"
                            value={cp.name}
                            onChange={(e) =>
                              setContactPeople((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Role / Title</Label>
                          <Input
                            placeholder="e.g. CEO, Director"
                            value={cp.role ?? ""}
                            onChange={(e) =>
                              setContactPeople((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, role: e.target.value } : p)),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("email")}</Label>
                          <Input
                            type="email"
                            placeholder={t("clientexamplecom")}
                            value={cp.email ?? ""}
                            onChange={(e) =>
                              setContactPeople((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, email: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("phone")}</Label>
                          <PhoneInput
                            id={`dlg-contact-phone-${idx}`}
                            countryCode={cp.phoneCountryCode}
                            nationalNumber={cp.phoneNational}
                            preferredCountryCode={defaultPhoneCountry}
                            onCountryCodeChange={(code) =>
                              setContactPeople((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, phoneCountryCode: code as CountryCode } : p,
                                ),
                              )
                            }
                            onNationalNumberChange={(national) =>
                              setContactPeople((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, phoneNational: national } : p,
                                ),
                              )
                            }
                            placeholder={t("700_000_000")}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-between items-center pt-1 gap-2">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {tc("back")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => void handleSaveBasic()}
                    disabled={savingBasic || !canProceed}
                  >
                    {savingBasic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save basic & complete later
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !canProceed || !!phoneDuplicate}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("creating")}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t("createClient")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
