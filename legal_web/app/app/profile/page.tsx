"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  Edit2,
  Save,
  X,
  Loader2,
  MapPin,
  CreditCard,
  Sparkles,
} from "lucide-react"
import { getMyProfile, updateMyProfile } from "@/lib/api/profile"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { persistCountrySelection } from "@/lib/geo/detect-country"
import { listPracticeAreas, type PracticeAreaOption } from "@/lib/api/templates"
import { CountryConfirmStep } from "@/components/issue-checker/country-confirm-step"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CountryCode } from "@/lib/api/types"
import Link from "next/link"

const CURRENCY_LABELS: Record<string, string> = {
  USD: "US Dollar ($)",
  INR: "Indian Rupee (₹)",
  KES: "Kenyan Shilling (KSh)",
  GBP: "British Pound (£)",
}

export default function ProfilePage() {
  const tCommon = useTranslations("common")
  const t = useTranslations("lawyer")
  const tAdmin = useTranslations("admin")
  const tAuth = useTranslations("auth")
  const { currentRole } = useRole()
  const { refreshDetection } = useDetectedCountry()
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [editedPhone, setEditedPhone] = useState("")
  const [editedCountryCode, setEditedCountryCode] = useState<CountryCode>("US")
  const [editedJurisdiction, setEditedJurisdiction] = useState("")
  const [editedPracticeArea, setEditedPracticeArea] = useState("")
  const [practiceAreas, setPracticeAreas] = useState<PracticeAreaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyProfile>> | null>(null)

  const roleDisplayNames: Record<string, string> = {
    PARTNER_ADMIN: "Partner (Admin)",
    JUNIOR_PARTNER: "Junior Partner",
    ASSOCIATE: "Associate",
    PARALEGAL: "Paralegal",
    FINANCE: "Finance",
    INTAKE: "Intake",
    OPS_HR: "Ops/HR",
    RECEPTION: "Reception",
    READ_ONLY: "Read-Only",
  }

  useEffect(() => {
    void Promise.all([getMyProfile(), listPracticeAreas()])
      .then(([p, areas]) => {
        setProfile(p)
        setPracticeAreas(areas)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false))
  }, [])

  const handleEdit = () => {
    if (!profile) return
    setEditedName(profile.name ?? "")
    setEditedPhone(profile.phone ?? "")
    setEditedCountryCode((profile.countryCode ?? "US") as CountryCode)
    setEditedJurisdiction(profile.jurisdiction ?? "")
    setEditedPracticeArea(profile.preferences?.primaryPracticeArea ?? "")
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setError("")
    try {
      const updated = await updateMyProfile({
        name: editedName,
        phone: editedPhone || undefined,
        preferences: editedPracticeArea
          ? { primaryPracticeArea: editedPracticeArea }
          : undefined,
        ...(profile.billing.canManageBilling
          ? {
              countryCode: editedCountryCode,
              jurisdiction: editedJurisdiction.trim() || undefined,
            }
          : {
              jurisdiction: editedJurisdiction.trim() || undefined,
            }),
      })
      setProfile(updated)
      setIsEditing(false)
      if (updated.countryCode) {
        persistCountrySelection(updated.countryCode as CountryCode, { userConfirmed: true })
      }
      await refreshDetection()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const user = profile ?? {
    name: "User",
    email: "",
    phone: null,
    countryCode: null,
    jurisdiction: null,
    countryName: "",
    currency: "USD",
    currencySymbol: "$",
    preferences: undefined,
    billing: {
      canManageBilling: false,
      primaryCurrency: "USD",
      currencySymbol: "$",
      primaryCountry: "US",
      tenantName: undefined,
    },
  }

  const currencyLabel =
    CURRENCY_LABELS[user.billing?.primaryCurrency ?? user.currency] ??
    `${user.billing?.primaryCurrency ?? user.currency} (${user.billing?.currencySymbol ?? user.currencySymbol})`

  return (
    <div className="p-6 space-y-6" data-tour="profile-form">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tCommon("profile")}</h1>
          <p className="text-muted-foreground">{t("manage_your_account_jurisdiction_and_billing")}</p>
        </div>
        {!isEditing ? (
          <Button onClick={handleEdit} variant="outline">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("profile_overview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user.name ?? "User"}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <Badge variant="outline" className="mt-2">
                  {roleDisplayNames[currentRole]}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("account_information")}</CardTitle>
            <CardDescription>{t("update_your_personal_information")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("full_name")}</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{user.name ?? "—"}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tAdmin("email")}</Label>
                <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{tAuth("phone")}</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                    <span>{user.phone ?? "—"}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("primary_practice_area")}</Label>
                {isEditing ? (
                  <Select
                    value={editedPracticeArea || undefined}
                    onValueChange={setEditedPracticeArea}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_your_specialty")} />
                    </SelectTrigger>
                    <SelectContent>
                      {practiceAreas.map((area) => (
                        <SelectItem key={area.slug} value={area.slug}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                    <span>
                      {practiceAreas.find((a) => a.slug === user.preferences?.primaryPracticeArea)
                        ?.label ??
                        user.preferences?.primaryPracticeArea ??
                        "Not set"}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Used to filter document templates on the Templates page.
                </p>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Jurisdiction
            </CardTitle>
            <CardDescription>
              Country is required; state or region is optional
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing && user.billing?.canManageBilling ? (
              <CountryConfirmStep
                countryCode={editedCountryCode}
                jurisdiction={editedJurisdiction}
                onCountryChange={(code) => {
                  setEditedCountryCode(code)
                  setEditedJurisdiction("")
                }}
                onJurisdictionChange={setEditedJurisdiction}
              />
            ) : isEditing ? (
              <div className="space-y-2">
                <CountryConfirmStep
                  countryCode={(profile?.countryCode ?? "US") as CountryCode}
                  jurisdiction={editedJurisdiction}
                  onCountryChange={() => {}}
                  onJurisdictionChange={setEditedJurisdiction}
                  hideCountry
                />
                <p className="text-xs text-muted-foreground">
                  Country and currency are managed by your firm admin.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{user.countryName || user.countryCode || "—"}</p>
                    {user.jurisdiction ? (
                      <p className="text-sm text-muted-foreground mt-0.5">{user.jurisdiction}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        No state or region set
                      </p>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    Edit jurisdiction
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing & Payments
            </CardTitle>
            <CardDescription>
              Primary currency is set from your country
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">{t("primary_currency")}</Label>
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <span className="text-lg font-medium">
                  {user.billing?.currencySymbol ?? user.currencySymbol}
                </span>
                <span>{currencyLabel}</span>
              </div>
              {isEditing && user.billing?.canManageBilling && (
                <p className="text-xs text-muted-foreground">
                  Changing country above updates your primary currency automatically.
                </p>
              )}
            </div>

            {user.billing?.tenantName && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t("firm")}</Label>
                <div className="p-2 rounded-md border bg-muted/50">
                  {user.billing.tenantName}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/app/settings/plan-usage">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Plan & AI credits
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/settings/billing">{t("billing_settings")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferences")}</CardTitle>
          <CardDescription>{t("notification_and_alert_settings")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/app/settings/notifications">{t("configure_notifications")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
