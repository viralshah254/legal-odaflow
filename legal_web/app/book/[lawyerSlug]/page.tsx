"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, CheckCircle, Loader2, Scale } from "lucide-react"
import {
  createPublicBooking,
  getLawyerBySlug,
  type MarketplaceLawyer,
} from "@/lib/api/marketplace"
import { ApiClientError } from "@/lib/api/client"

const ISSUE_TYPES = [
  "Employment",
  "Housing",
  "Family",
  "Immigration",
  "Business",
  "Consumer",
  "Civil",
  "Other",
]

const TIME_SLOTS = [
  { label: "Tomorrow 9:00 AM", offsetDays: 1, hour: 9 },
  { label: "Tomorrow 2:00 PM", offsetDays: 1, hour: 14 },
  { label: "In 2 days 10:00 AM", offsetDays: 2, hour: 10 },
  { label: "In 3 days 11:00 AM", offsetDays: 3, hour: 11 },
]

function buildSlotIso(offsetDays: number, hour: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export default function PublicBookingPage() {
  const toISOString = useTranslations("common")
  const t = useTranslations("common")
  const tAuth = useTranslations("auth")
  const tAdmin = useTranslations("admin")
  const params = useParams()
  const lawyerSlug = String(params.lawyerSlug ?? "")

  const [lawyer, setLawyer] = useState<MarketplaceLawyer | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [issueType, setIssueType] = useState("Employment")
  const [slotKey, setSlotKey] = useState("0")
  const [description, setDescription] = useState("")

  const selectedSlot = useMemo(() => {
    const index = Number(slotKey)
    const slot = TIME_SLOTS[index] ?? TIME_SLOTS[0]
    return buildSlotIso(slot.offsetDays, slot.hour)
  }, [slotKey])

  useEffect(() => {
    if (!lawyerSlug) return
    setLoading(true)
    getLawyerBySlug(lawyerSlug)
      .then(setLawyer)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : "Lawyer not found"),
      )
      .finally(() => setLoading(false))
  }, [lawyerSlug])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!lawyer) return

    setSubmitting(true)
    setError(null)
    try {
      await createPublicBooking({
        lawyerId: lawyer.id,
        slot: selectedSlot,
        clientName,
        clientEmail,
        clientPhone: clientPhone || undefined,
        issueType,
        countryCode: lawyer.countryCode,
        description: description || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Booking failed")
    } finally {
      setSubmitting(false)
    }
  }

  const lawyerName = lawyer?.user?.name ?? "Lawyer"

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-950">
      <CinematicNavbar />
      <main className="flex-1 container max-w-3xl py-14 sm:py-20 px-4 space-y-8">
        <div className="space-y-2">
          <Badge variant="secondary">{t("public_booking")}</Badge>
          <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Book a consultation
          </h1>
          <p className="text-lg text-slate-600">
            Request a consultation slot. This creates a lead for the lawyer — not legal advice.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error && !lawyer ? (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-destructive">{error}</p>
              <Button asChild variant="outline">
                <Link href="/legal-issue-checker">{t("find_legal_help")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : success ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Booking request sent
              </CardTitle>
              <CardDescription>
                {lawyerName} will review your request and confirm the consultation time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/legal-issue-checker">{t("back_to_issue_checker")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : lawyer ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {lawyerName}
                </CardTitle>
                <CardDescription>
                  {lawyer.countryCode}
                  {lawyer.consultationFee != null
                    ? ` · Consultation from ${lawyer.currency ?? "USD"} ${lawyer.consultationFee}`
                    : ""}
                </CardDescription>
              </CardHeader>
              {Array.isArray(lawyer.practiceAreas) && lawyer.practiceAreas.length > 0 && (
                <CardContent className="flex flex-wrap gap-2">
                  {lawyer.practiceAreas.slice(0, 6).map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("your_details")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{tAuth("fullName")}</Label>
                      <Input
                        id="name"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{tAdmin("email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone_optional")}</Label>
                    <Input
                      id="phone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("issue_type")}</Label>
                      <Select value={issueType} onValueChange={setIssueType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ISSUE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("preferred_slot")}</Label>
                      <Select value={slotKey} onValueChange={setSlotKey}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot, index) => (
                            <SelectItem key={slot.label} value={String(index)}>
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t("brief_description")}</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      placeholder={t("summarize_your_situation_in_a_few_sentences")}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Request consultation"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        ) : null}

        <LegalDisclaimer />
      </main>
      <CinematicFooter />
    </div>
  )
}
