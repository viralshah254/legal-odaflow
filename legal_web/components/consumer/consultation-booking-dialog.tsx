"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle, Loader2, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createPublicBooking, type MarketplaceLawyer } from "@/lib/api/marketplace"
import { ApiClientError } from "@/lib/api/client"
import { useAuth } from "@/lib/contexts/auth-context"

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

function lawyerDisplayName(lawyer: MarketplaceLawyer) {
  return lawyer.name ?? lawyer.user?.name ?? "Legal professional"
}

interface ConsultationBookingDialogProps {
  lawyer: MarketplaceLawyer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConsultationBookingDialog({
  lawyer,
  open,
  onOpenChange,
}: ConsultationBookingDialogProps) {
  const t = useTranslations("common")
  const tAuth = useTranslations("auth")
  const tAdmin = useTranslations("admin")
  const { user } = useAuth()

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
    if (!open) return
    setSuccess(false)
    setError(null)
    setSubmitting(false)
    setClientName(user?.name ?? "")
    setClientEmail(user?.email ?? "")
    setClientPhone("")
    setIssueType("Employment")
    setSlotKey("0")
    setDescription("")
  }, [open, user?.name, user?.email])

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

  const displayName = lawyer ? lawyerDisplayName(lawyer) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Booking request sent
              </DialogTitle>
              <DialogDescription>
                {displayName} will review your request and confirm the consultation time.
              </DialogDescription>
            </DialogHeader>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                {t("request_consultation")}
              </DialogTitle>
              <DialogDescription>
                {lawyer ? (
                  <>
                    {displayName} · {lawyer.countryCode}
                    {lawyer.consultationFee != null
                      ? ` · From ${lawyer.currency ?? "USD"} ${lawyer.consultationFee}`
                      : ""}
                  </>
                ) : (
                  "Request a consultation slot. This creates a lead for the lawyer — not legal advice."
                )}
              </DialogDescription>
            </DialogHeader>

            {lawyer && Array.isArray(lawyer.practiceAreas) && lawyer.practiceAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2 -mt-2">
                {lawyer.practiceAreas.slice(0, 6).map((area) => (
                  <Badge key={area} variant="outline" className="text-xs">
                    {area}
                  </Badge>
                ))}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="booking-name">{tAuth("fullName")}</Label>
                  <Input
                    id="booking-name"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-email">{tAdmin("email")}</Label>
                  <Input
                    id="booking-email"
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-phone">{t("phone_optional")}</Label>
                <Input
                  id="booking-phone"
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
                <Label htmlFor="booking-description">{t("brief_description")}</Label>
                <Textarea
                  id="booking-description"
                  rows={3}
                  placeholder={t("summarize_your_situation_in_a_few_sentences")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" disabled={submitting || !lawyer} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  t("request_consultation")
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
