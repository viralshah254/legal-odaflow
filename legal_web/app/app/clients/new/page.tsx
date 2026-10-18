"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { createClient as createApiClient, listClients } from "@/lib/api/clients"
import { initializeKycForClient } from "@/lib/api/kyc"
import { ConflictCheckPanel } from "@/components/conflicts/ConflictCheckPanel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, Save, Loader2, Plus, X } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useDefaultPhoneCountry } from "@/lib/hooks/use-default-phone-country"
import type { ClientType, ContactPerson, CountryCode } from "@/lib/api/types"
import { ApiClientError } from "@/lib/api/client"
import { getCountryName, getDefaultCountryCode } from "@/lib/geo/detect-country"
import { formatPhoneNumber } from "@/lib/geo/phone-codes"
import { isFuzzyDuplicate, normalizePhone, getPhoneCountry, digitsOnly } from "@/lib/phone"
import type { ApiClient } from "@/lib/api/types"
import { AlertTriangle } from "lucide-react"

const CORPORATE_TYPES: ClientType[] = ["COMPANY", "NGO", "PARTNERSHIP"]

interface ContactPersonForm {
  name: string
  role: string
  email: string
  phoneCountryCode: CountryCode
  phoneNational: string
}

function emptyContactPerson(defaultCountry: CountryCode): ContactPersonForm {
  return { name: "", role: "", email: "", phoneCountryCode: defaultCountry, phoneNational: "" }
}

const CLIENT_TYPES: ClientType[] = ["INDIVIDUAL", "COMPANY", "NGO", "PARTNERSHIP"]

const COUNTRY_NAME_TO_CODE: Record<string, CountryCode> = {
  Kenya: "KE",
  India: "IN",
  "United States": "US",
  "United Kingdom": "GB",
}

export default function NewClientPage() {
  const toString = useTranslations("clients")
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const router = useRouter()
  const { activeTenantId, activeTenant } = useTenant()
  const { countryCode: defaultPhoneCountry, isLoading: phoneCountryLoading } = useDefaultPhoneCountry()
  const tenantCountryCode = (activeTenant?.tenant.primaryCountry ?? "KE") as CountryCode
  const [step, setStep] = useState(1)
  const [clientType, setClientType] = useState<ClientType>("INDIVIDUAL")
  const [submitting, setSubmitting] = useState(false)
  const [savingBasic, setSavingBasic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictClear, setConflictClear] = useState(false)
  const [contactPeople, setContactPeople] = useState<ContactPersonForm[]>(() => [
    emptyContactPerson(getDefaultCountryCode() as CountryCode),
  ])
  const [phoneCountryCode, setPhoneCountryCode] = useState<CountryCode>(tenantCountryCode)
  const [phoneNational, setPhoneNational] = useState("")
  const [phoneDuplicate, setPhoneDuplicate] = useState<ApiClient | null>(null)
  const dupCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    country: getCountryName(tenantCountryCode),
  })

  useEffect(() => {
    if (phoneCountryLoading || !defaultPhoneCountry) return
    const code = defaultPhoneCountry as CountryCode
    setPhoneCountryCode(code)
    setContactPeople((prev) =>
      prev.map((cp) =>
        !digitsOnly(cp.phoneNational) ? { ...cp, phoneCountryCode: code } : cp,
      ),
    )
  }, [defaultPhoneCountry, phoneCountryLoading])

  useEffect(() => {
    if (!activeTenant?.tenant.primaryCountry) return
    const code = activeTenant.tenant.primaryCountry as CountryCode
    setFormData((prev) => ({
      ...prev,
      country: getCountryName(code),
    }))
  }, [activeTenant?.tenant.primaryCountry])

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

  const buildContactPeople = (): ContactPerson[] | undefined => {
    if (!isCorporate) return undefined
    const filled = contactPeople.filter((cp) => cp.name.trim())
    return filled.length > 0 ? filled.map((cp) => ({
      name: cp.name.trim(),
      role: cp.role?.trim() || undefined,
      email: cp.email?.trim() || undefined,
      phone: formatPhoneNumber(cp.phoneCountryCode, cp.phoneNational) || undefined,
    })) : undefined
  }

  const handleSaveBasic = async () => {
    setError(null)
    if (!activeTenantId) { setError(t("noActiveTenant")); return }
    setSavingBasic(true)
    try {
      const countryCode = COUNTRY_NAME_TO_CODE[formData.country] ?? tenantCountryCode
      const newClient = await createApiClient(activeTenantId, {
        name: formData.name.trim(),
        type: clientType,
        countryCode,
      })
      try {
        await initializeKycForClient(activeTenantId, newClient.id, clientType, countryCode)
      } catch {
        // ignore duplicate init
      }
      router.push(`/app/clients/${newClient.id}`)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("failedToCreate"))
    } finally {
      setSavingBasic(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!conflictClear) {
      setError(t("conflictCheckRequired"))
      return
    }
    if (phoneDuplicate) {
      setError(t("phoneDuplicateError", { name: phoneDuplicate.name }))
      return
    }
    setSubmitting(true)
    try {
      if (!activeTenantId) {
        setError(t("noActiveTenant"))
        return
      }

      const countryCode =
        COUNTRY_NAME_TO_CODE[formData.country] ?? phoneCountryCode ?? tenantCountryCode
      const phone = formatPhoneNumber(phoneCountryCode, phoneNational)
      const newClient = await createApiClient(activeTenantId, {
        name: formData.name.trim(),
        email: formData.email || undefined,
        phone: phone || undefined,
        address: formData.address.trim() || undefined,
        type: clientType,
        countryCode,
        contactPeople: buildContactPeople(),
      })
      try {
        await initializeKycForClient(
          activeTenantId,
          newClient.id,
          clientType,
          countryCode,
        )
      } catch {
        // Server also initializes on create; ignore duplicate init failures
      }
      router.push(`/app/clients/${newClient.id}`)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("failedToCreate"))
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedToKyc = formData.name.trim() !== ""

  const parties = useMemo(
    () => [
      {
        name: formData.name.trim() || undefined,
        email: formData.email.trim() || undefined,
      },
    ],
    [formData.name, formData.email],
  )

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/app/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("addNewClient")}</h1>
          <p className="text-muted-foreground">{t("createClientProfile")}</p>
        </div>
      </div>

      <Tabs value={step.toString()} onValueChange={(v) => setStep(parseInt(v))} className="w-full" data-tour="client-form">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="1">{t("clientDetails")}</TabsTrigger>
          <TabsTrigger value="2" disabled={step < 2 || !canProceedToKyc}>
            {t("contacts")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("clientInformation")}</CardTitle>
              <CardDescription>{t("basicClientDetails")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-type">{t("clientType")} *</Label>
                <Select
                  value={clientType}
                  onValueChange={(value) => setClientType(value as ClientType)}
                >
                  <SelectTrigger id="client-type">
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
                <Label htmlFor="name">{t("clientName")} *</Label>
                <Input
                  id="name"
                  placeholder={t("enterClientName")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => void handleSaveBasic()}
                  disabled={!canProceedToKyc || savingBasic}
                  className="text-muted-foreground text-sm"
                >
                  {savingBasic ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t("saveBasicAndCompleteLater")}
                </Button>
                <Button onClick={() => setStep(2)} disabled={!canProceedToKyc}>
                  {t("nextContacts")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("contactInformation")}</CardTitle>
              <CardDescription>{t("clientContactDetails")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("clientexamplecom")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <PhoneInput
                  id="phone"
                  countryCode={phoneCountryCode}
                  nationalNumber={phoneNational}
                  preferredCountryCode={defaultPhoneCountry}
                  onCountryCodeChange={(code) => setPhoneCountryCode(code as CountryCode)}
                  onNationalNumberChange={setPhoneNational}
                  placeholder={t("700_000_000")}
                />
                {phoneDuplicate && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                      {t("phoneDuplicateWarning", { name: phoneDuplicate.name })}{" "}
                      <a href={`/app/clients/${phoneDuplicate.id}`} className="underline font-medium">
                        {t("viewExistingClient")}
                      </a>.
                    </p>
                  </div>
                )}
              </div>

              {/* Contact people — corporate types only */}
              {isCorporate && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t("contactPeople")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setContactPeople((prev) => [
                          ...prev,
                          emptyContactPerson(tenantCountryCode),
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {t("addContactPerson")}
                    </Button>
                  </div>
                  {contactPeople.map((cp, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {t("contactPersonNumber", { n: idx + 1 })}
                        </p>
                        {contactPeople.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setContactPeople((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={t("removeContactPerson")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("name")} *</Label>
                          <Input
                            placeholder={t("contactNamePlaceholder")}
                            value={cp.name}
                            onChange={(e) => setContactPeople((prev) => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("roleTitle")}</Label>
                          <Input
                            placeholder={t("contactRolePlaceholder")}
                            value={cp.role ?? ""}
                            onChange={(e) => setContactPeople((prev) => prev.map((p, i) => i === idx ? { ...p, role: e.target.value } : p))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("email")}</Label>
                          <Input
                            type="email"
                            placeholder={t("clientexamplecom")}
                            value={cp.email ?? ""}
                            onChange={(e) => setContactPeople((prev) => prev.map((p, i) => i === idx ? { ...p, email: e.target.value } : p))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("phone")}</Label>
                          <PhoneInput
                            id={`contact-phone-${idx}`}
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

              <div className="space-y-2">
                <Label htmlFor="address">{t("address")}</Label>
                <Input
                  id="address"
                  placeholder={t("streetAddress")}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{tc("country")}</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {tc("back")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSaveBasic}
                    disabled={savingBasic || !canProceedToKyc}
                    title="Create client with name only — you can add contact details later"
                  >
                    {savingBasic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save basic info &amp; complete later
                  </Button>
                </div>
                <Button onClick={handleSubmit} disabled={submitting || !canProceedToKyc || !conflictClear} data-tour="client-submit">
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
            </CardContent>
          </Card>

          {activeTenantId && (
            <ConflictCheckPanel
              tenantId={activeTenantId}
              parties={parties}
              onClear={() => setConflictClear(true)}
              onReviewRequired={() => setConflictClear(false)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
