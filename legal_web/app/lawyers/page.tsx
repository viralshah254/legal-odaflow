"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Reveal } from "@/components/motion/reveal"
import { CalendarCheck, CheckCircle2, Loader2, MapPin, Scale, ShieldCheck, Star } from "lucide-react"
import { listLawyers, type MarketplaceLawyer } from "@/lib/api/marketplace"

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "KE", label: "Kenya" },
  { code: "GB", label: "United Kingdom" },
]

export default function LawyersPage() {
  const t = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const [countryCode, setCountryCode] = useState("US")
  const [lawyers, setLawyers] = useState<MarketplaceLawyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          setError(err instanceof Error ? err.message : "Failed to load lawyers")
          setLawyers([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [countryCode])

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-4xl space-y-10 px-4 sm:px-6">
          <Reveal mode="mount" className="space-y-5 text-center">
            <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t("find_a_lawyer")}</h1>
            <p className="mx-auto max-w-xl text-lg leading-8 text-slate-600">Browse verified lawyers accepting new clients in your country.</p>
            <div className="flex justify-center">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[220px] rounded-full border-slate-200 bg-white shadow-sm">
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
          </Reveal>

          <Reveal mode="mount" delay={0.1} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Verified profiles", icon: ShieldCheck },
              { label: "Lead quality scoring", icon: Star },
              { label: "Booking ready", icon: CalendarCheck },
              { label: "Compliance reviewed", icon: CheckCircle2 },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
                <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                {label}
              </div>
            ))}
          </Reveal>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-900">{t("loading_lawyers")}</p>
            </div>
          ) : error ? (
            <p className="text-center text-rose-600">{error}</p>
          ) : lawyers.length === 0 ? (
            <p className="text-center text-slate-500">No verified lawyers found for this country yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lawyers.map((lawyer, index) => (
                <Reveal key={lawyer.id} delay={(index % 2) * 0.06} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{lawyer.name}</h3>
                      <p className="text-sm text-slate-500">{lawyer.headline ?? "Legal professional"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{lawyer.countryCode}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Verified</span>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">{t("referral_tracked")}</span>
                    {(lawyer.practiceAreas ?? []).slice(0, 4).map((area) => (
                      <span key={area} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">{area}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{lawyer.countryCode}</span>
                    {lawyer.consultationFee ? (
                      <span className="flex items-center gap-1"><Scale className="h-4 w-4" />From {lawyer.consultationFee} {lawyer.currency ?? ""}</span>
                    ) : null}
                  </div>
                  <Link href={lawyer.slug ? `/book/${lawyer.slug}` : `/book/${lawyer.id}`} className="mt-5 block">
                    <Button className="w-full rounded-full">{t("request_consultation")}</Button>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </main>
      <CinematicFooter />
    </div>
  )
}
