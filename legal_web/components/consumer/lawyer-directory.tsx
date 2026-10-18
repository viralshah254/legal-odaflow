"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ConsultationBookingDialog } from "@/components/consumer/consultation-booking-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listLawyers, type MarketplaceLawyer } from "@/lib/api/marketplace"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { CalendarCheck, MapPin, Scale, Search, ShieldCheck, Star } from "lucide-react"

const COUNTRIES = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "KE", label: "Kenya" },
] as const

function lawyerDisplayName(lawyer: MarketplaceLawyer) {
  return lawyer.name ?? lawyer.user?.name ?? "Legal professional"
}

export function LawyerDirectory() {
  const t = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const { countryCode: detectedCountry } = useDetectedCountry()
  const [countryCode, setCountryCode] = useState(detectedCountry ?? "IN")
  const [search, setSearch] = useState("")
  const [lawyers, setLawyers] = useState<MarketplaceLawyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookingLawyer, setBookingLawyer] = useState<MarketplaceLawyer | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)

  useEffect(() => {
    if (detectedCountry) setCountryCode(detectedCountry)
  }, [detectedCountry])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listLawyers(countryCode)
      .then((rows) => {
        if (!cancelled) setLawyers(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("findLawyerLoadError"))
          setLawyers([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [countryCode, t])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lawyers
    return lawyers.filter((lawyer) => {
      const haystack = [
        lawyerDisplayName(lawyer),
        lawyer.headline ?? "",
        ...(lawyer.practiceAreas ?? []),
        ...(lawyer.jurisdictions ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [lawyers, search])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("nav.findLawyer")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("findLawyerSubtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("findLawyerVerified"), icon: ShieldCheck },
          { label: t("findLawyerOnPlatform"), icon: Star },
          { label: t("findLawyerBook"), icon: CalendarCheck },
          { label: t("findLawyerCompliance"), icon: Scale },
        ].map(({ label, icon: Icon }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="flex items-center gap-2 p-4 text-sm font-medium">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              {label}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3" data-tour="consumer-find-lawyer-search">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("findLawyerSearchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={countryCode} onValueChange={setCountryCode}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder={tAdmin("country")} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">{tCommon("loading_lawyers")}</p>
      ) : error ? (
        <p className="text-center text-destructive py-12">{error}</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("findLawyerEmpty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-tour="consumer-find-lawyer-results">
          {filtered.map((lawyer) => (
            <Card key={lawyer.id} className="border-border/60 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{lawyerDisplayName(lawyer)}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {(lawyer as MarketplaceLawyer & { bio?: string | null }).bio?.slice(0, 120) ||
                        lawyer.headline ||
                        t("findLawyerDefaultHeadline")}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{lawyer.countryCode}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400" variant="outline">
                    {t("findLawyerVerifiedBadge")}
                  </Badge>
                  {(lawyer.practiceAreas ?? []).slice(0, 4).map((area) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {lawyer.countryCode}
                  </span>
                  {lawyer.consultationFee ? (
                    <span className="flex items-center gap-1">
                      <Scale className="h-4 w-4 shrink-0" />
                      {t("findLawyerFromFee", {
                        amount: lawyer.consultationFee,
                        currency: lawyer.currency ?? "",
                      })}
                    </span>
                  ) : null}
                </div>
                <Button
                  className="w-full"
                  type="button"
                  onClick={() => {
                    setBookingLawyer(lawyer)
                    setBookingOpen(true)
                  }}
                >
                  {tCommon("request_consultation")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConsultationBookingDialog
        lawyer={bookingLawyer}
        open={bookingOpen}
        onOpenChange={(open) => {
          setBookingOpen(open)
          if (!open) setBookingLawyer(null)
        }}
      />
    </div>
  )
}
