"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  User,
  Briefcase,
  Globe,
  Save,
  Loader2,
  CheckCircle,
  ShieldCheck,
} from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { PRACTICE_AREAS } from "@/lib/taxonomy/platform-taxonomy"

type SpecialtyLevel = "Junior" | "Senior" | "Partner" | "Consultant"
const SPECIALTY_LEVELS: SpecialtyLevel[] = ["Junior", "Senior", "Partner", "Consultant"]

const JURISDICTIONS_BY_COUNTRY = {
  KE: { label: "🇰🇪 Kenya (LSK)", placeholder: "LSK/12345" },
  US: { label: "🇺🇸 United States (State Bar)", placeholder: "CA Bar 67890 / NY Bar 12345" },
  GB: { label: "🇬🇧 United Kingdom (SRA)", placeholder: "SRA 123456" },
  IN: { label: "🇮🇳 India (Bar Council)", placeholder: "BCI/DL/2020/123" },
}

const LANGUAGES = [
  "English", "French", "Swahili", "Arabic", "Hindi", "Spanish",
  "Mandarin", "Portuguese", "German", "Bengali", "Urdu", "Other",
]

interface LawyerProfileData {
  countryCode: string
  barNumber?: string
  practiceAreas: string[]
  jurisdictions: string[]
  languages: string[]
  currency: string
  consultationFee?: number
  acceptsLeads?: boolean
  specialtyLevel?: Record<string, SpecialtyLevel>
  jurisdictionLicenses?: Record<string, string>
  yearsExperience?: number
  bio?: string
}

async function getLawyerProfile(): Promise<LawyerProfileData | null> {
  try {
    return await apiFetch<LawyerProfileData>("/marketplace/lawyer-profile/me")
  } catch {
    return null
  }
}

async function upsertLawyerProfile(data: LawyerProfileData): Promise<LawyerProfileData> {
  return apiFetch<LawyerProfileData>("/marketplace/lawyer-profile", {
    method: "POST",
    body: data,
  })
}

export default function ProfileSettingsPage() {
  const toString = useTranslations("settings")
  const t = useTranslations("settings")
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: existing, isLoading } = useQuery({
    queryKey: ["lawyer-profile-me"],
    queryFn: getLawyerProfile,
  })

  const [practiceAreas, setPracticeAreas] = useState<string[]>([])
  const [specialtyLevel, setSpecialtyLevel] = useState<Record<string, SpecialtyLevel>>({})
  const [jurisdictionLicenses, setJurisdictionLicenses] = useState<Record<string, string>>({})
  const [languages, setLanguages] = useState<string[]>(["English"])
  const [yearsExperience, setYearsExperience] = useState<string>("")
  const [bio, setBio] = useState("")
  const [barNumber, setBarNumber] = useState("")
  const [consultationFee, setConsultationFee] = useState("")
  const [acceptsLeads, setAcceptsLeads] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Initialize from existing profile
  if (existing && !initialized) {
    setInitialized(true)
    setPracticeAreas(existing.practiceAreas ?? [])
    setSpecialtyLevel((existing.specialtyLevel as Record<string, SpecialtyLevel>) ?? {})
    setJurisdictionLicenses((existing.jurisdictionLicenses as Record<string, string>) ?? {})
    setLanguages(existing.languages ?? ["English"])
    setYearsExperience(existing.yearsExperience?.toString() ?? "")
    setBio(existing.bio ?? "")
    setBarNumber(existing.barNumber ?? "")
    setConsultationFee(existing.consultationFee?.toString() ?? "")
    setAcceptsLeads(existing.acceptsLeads ?? true)
  }

  const mutation = useMutation({
    mutationFn: upsertLawyerProfile,
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ["lawyer-profile-me"] })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleSave = () => {
    mutation.mutate({
      countryCode: existing?.countryCode ?? "US",
      barNumber: barNumber.trim() || undefined,
      practiceAreas,
      jurisdictions: Object.keys(jurisdictionLicenses).filter((k) => jurisdictionLicenses[k]),
      languages,
      currency: existing?.currency ?? "USD",
      consultationFee: consultationFee ? Number(consultationFee) : undefined,
      acceptsLeads,
      specialtyLevel,
      jurisdictionLicenses,
      yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
      bio: bio.trim() || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/app/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            My Profile & Specialties
          </h1>
          <p className="text-muted-foreground">
            Set your practice area specialties, bar licences, and professional profile
          </p>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("saving")}</>
          ) : saved ? (
            <><CheckCircle className="mr-2 h-4 w-4 text-green-500" />{t("saved")}</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />{t("save_profile")}</>
          )}
        </Button>
      </div>

      {mutation.isError && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive text-sm">
            Failed to save profile. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Practice Areas & Specialties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Practice Area Specialties
          </CardTitle>
          <CardDescription>
            Select the areas of law you practice and your experience level in each.
            This is used for matter assignment, client matching, and your firm directory profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md divide-y">
            {PRACTICE_AREAS.map((pa) => {
              const isSelected = practiceAreas.includes(pa.slug)
              return (
                <div key={pa.slug} className="flex items-center gap-3 p-4">
                  <Checkbox
                    id={`pa-${pa.slug}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPracticeAreas([...practiceAreas, pa.slug])
                      } else {
                        setPracticeAreas(practiceAreas.filter((s) => s !== pa.slug))
                        const next = { ...specialtyLevel }
                        delete next[pa.slug]
                        setSpecialtyLevel(next)
                      }
                    }}
                  />
                  <Label htmlFor={`pa-${pa.slug}`} className="flex-1 cursor-pointer font-normal">
                    {pa.label}
                  </Label>
                  {isSelected && (
                    <Select
                      value={specialtyLevel[pa.slug] ?? "Senior"}
                      onValueChange={(v) =>
                        setSpecialtyLevel((prev) => ({ ...prev, [pa.slug]: v as SpecialtyLevel }))
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTY_LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
          {practiceAreas.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">{t("selected")}</span>
              {practiceAreas.map((slug) => (
                <Badge key={slug} variant="secondary" className="text-xs">
                  {specialtyLevel[slug] && `${specialtyLevel[slug]} — `}
                  {PRACTICE_AREAS.find((p) => p.slug === slug)?.label ?? slug}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Licences & Jurisdictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Bar Licences & Admissions
          </CardTitle>
          <CardDescription>
            Your bar registration numbers by jurisdiction. Used for verification and client trust signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(JURISDICTIONS_BY_COUNTRY).map(([code, meta]) => (
            <div key={code} className="space-y-1.5">
              <Label htmlFor={`lic-${code}`}>{meta.label}</Label>
              <Input
                id={`lic-${code}`}
                value={jurisdictionLicenses[code] ?? ""}
                onChange={(e) =>
                  setJurisdictionLicenses((prev) => ({ ...prev, [code]: e.target.value }))
                }
                placeholder={meta.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Professional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Professional Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="years">{t("years_of_experience")}</Label>
              <Input
                id="years"
                type="number"
                min="0"
                max="60"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                placeholder={t("eg_12")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee">{t("consultation_fee")}</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                placeholder={t("eg_150")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">{t("professional_bio")}</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("brief_professional_biography_for_your_marketplace_profile")}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">{bio.length}/1000</p>
          </div>

          <Separator />

          <div>
            <Label>{t("languages")}</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {LANGUAGES.map((lang) => {
                const selected = languages.includes(lang)
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setLanguages(languages.filter((l) => l !== lang))
                      } else {
                        setLanguages([...languages, lang])
                      }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    {lang}
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Checkbox
              id="accepts-leads"
              checked={acceptsLeads}
              onCheckedChange={(v) => setAcceptsLeads(!!v)}
            />
            <div>
              <Label htmlFor="accepts-leads" className="cursor-pointer">
                Accept marketplace leads
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow consumers to request a review from you via the legal issue checker
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} size="lg">
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("saving")}</>
          ) : saved ? (
            <><CheckCircle className="mr-2 h-4 w-4 text-green-500" />{t("saved")}</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />{t("save_profile")}</>
          )}
        </Button>
      </div>
    </div>
  )
}
