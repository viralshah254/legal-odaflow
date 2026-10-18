"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, ArrowRight, Scale } from "lucide-react"

const COUNTRY_OPTIONS = [
  { code: "ALL", label: "All countries" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "KE", label: "Kenya" },
  { code: "IN", label: "India" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
] as const

const FORM_CATALOG = [
  {
    id: "tenant-notice",
    title: "Tenant / landlord notice",
    category: "Housing",
    countries: ["US", "GB", "KE", "CA", "AU"],
    description: "Review a notice to quit, rent increase, or repair demand.",
    checkerParams: "?category=housing",
    generateParams: "?category=housing&intent=generate&form=tenant-notice",
  },
  {
    id: "employment-termination",
    title: "Employment termination letter",
    category: "Employment",
    countries: ["US", "GB", "KE", "IN", "CA", "AU"],
    description: "Understand severance, wrongful termination, and next steps.",
    checkerParams: "?category=employment",
    generateParams: "?category=employment&intent=generate&form=employment-termination",
  },
  {
    id: "small-claims",
    title: "Small claims demand letter",
    category: "Civil",
    countries: ["US", "GB", "KE", "IN", "CA", "AU"],
    description: "Draft context for a payment or contract dispute demand.",
    checkerParams: "?category=civil",
    generateParams: "?category=civil&intent=generate&form=small-claims",
  },
  {
    id: "family-custody",
    title: "Custody / parenting plan",
    category: "Family",
    countries: ["US", "GB", "KE", "CA", "AU"],
    description: "Explore custody modification and parenting schedule issues.",
    checkerParams: "?category=family",
    generateParams: "?category=family&intent=generate&form=family-custody",
  },
  {
    id: "consumer-refund",
    title: "Consumer refund dispute",
    category: "Consumer",
    countries: ["US", "GB", "KE", "IN", "CA", "AU"],
    description: "Challenge a refund denial or defective product claim.",
    checkerParams: "?category=consumer",
    generateParams: "?category=consumer&intent=generate&form=consumer-refund",
  },
  {
    id: "immigration-docs",
    title: "Immigration document review",
    category: "Immigration",
    countries: ["US", "GB", "IN", "CA", "AU"],
    description: "Identify gaps in visa or status application paperwork.",
    checkerParams: "?category=immigration",
    generateParams: "?category=immigration&intent=generate&form=immigration-docs",
  },
  {
    id: "business-contract",
    title: "Business contract review",
    category: "Business",
    countries: ["US", "GB", "KE", "IN", "CA", "AU"],
    description: "Spot risky clauses in vendor or client agreements.",
    checkerParams: "?category=business",
    generateParams: "?category=business&intent=generate&form=business-contract",
  },
  {
    id: "debt-collection",
    title: "Debt collection response",
    category: "Finance",
    countries: ["US", "GB", "KE", "IN", "CA", "AU"],
    description: "Respond to collection notices and validate debts.",
    checkerParams: "?category=finance",
    generateParams: "?category=finance&intent=generate&form=debt-collection",
  },
] as const

const CATEGORIES = ["All", ...Array.from(new Set(FORM_CATALOG.map((f) => f.category)))]

export default function LegalFormsPage() {
  const t = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const [country, setCountry] = useState<string>("ALL")
  const [category, setCategory] = useState<string>("All")

  const filteredForms = useMemo(() => {
    return FORM_CATALOG.filter((form) => {
      const countryMatch =
        country === "ALL" || (form.countries as readonly string[]).includes(country)
      const categoryMatch = category === "All" || form.category === category
      return countryMatch && categoryMatch
    })
  }, [country, category])

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-950">
      <CinematicNavbar />
      <main className="flex-1 container max-w-5xl py-14 sm:py-20 px-4 space-y-8">
        <Reveal mode="mount" className="space-y-3">
          <Badge variant="secondary">{t("consumer_library")}</Badge>
          <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Legal forms catalog
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            Browse common legal situations by country and category, then open the issue checker
            to analyze your documents and get structured guidance. This is not legal advice.
          </p>
        </Reveal>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium">{tAdmin("country")}</p>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium">{t("category")}</p>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredForms.length} form{filteredForms.length === 1 ? "" : "s"}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {filteredForms.map((form) => (
            <Card key={form.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{form.title}</CardTitle>
                  <Badge variant="outline">{form.category}</Badge>
                </div>
                <CardDescription>{form.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1">
                  {form.countries.map((code) => (
                    <Badge key={code} variant="secondary" className="text-[10px]">
                      {code}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/legal-issue-checker${form.checkerParams}&country=${country === "ALL" ? "US" : country}`}>
                      Check my issue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href={`/legal-issue-checker${form.generateParams}&country=${country === "ALL" ? "US" : country}`}>
                      Generate draft
                      <FileText className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredForms.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No forms match this country and category. Try broadening your filters.
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5" />
              Need something else?
            </CardTitle>
            <CardDescription>
              Start a free-form analysis for any legal issue not listed above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/legal-issue-checker">{t("open_issue_checker")}</Link>
            </Button>
          </CardContent>
        </Card>

        <LegalDisclaimer />
      </main>
      <CinematicFooter />
    </div>
  )
}
