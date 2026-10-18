import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Reveal } from "@/components/motion/reveal"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  COUNTRY_MARKET_CODES,
  COUNTRY_MARKETS,
  getCountryMarket,
  type CountryMarketCode,
} from "@/lib/seo/country-markets"
import { LEGAL_GUIDE_STATIC_PARAMS, legalGuidePath } from "@/lib/seo/public-routes"
import { buildCountryMarketMetadata } from "@/lib/seo/site-metadata"
import { buildFaqPageSchema, type FaqItem } from "@/lib/seo/structured-data"
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Scale,
  Sparkles,
  Users,
} from "lucide-react"

export function generateStaticParams() {
  return COUNTRY_MARKET_CODES.map((market) => ({ market }))
}

interface MarketPageProps {
  params: Promise<{ market: string }>
}

export async function generateMetadata({ params }: MarketPageProps): Promise<Metadata> {
  const { market } = await Promise.resolve(params)
  const config = getCountryMarket(market)
  if (!config) return {}
  return buildCountryMarketMetadata(config.code)
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default async function CountryMarketPage({ params }: MarketPageProps) {
  const { market } = await Promise.resolve(params)
  const config = getCountryMarket(market)
  if (!config) notFound()

  const t = await getTranslations("marketing")
  const key = config.i18nKey as CountryMarketCode
  const consumerBullets = (t.raw(`countryPages.${key}.consumerBullets`) ?? []) as string[]
  const firmBullets = (t.raw(`countryPages.${key}.firmBullets`) ?? []) as string[]
  const faqItems = (t.raw(`countryPages.${key}.faqItems`) ?? []) as FaqItem[]
  const faqSchema = faqItems.length > 0 ? buildFaqPageSchema(faqItems) : null

  const guides = LEGAL_GUIDE_STATIC_PARAMS.filter((g) => g.country === config.code)

  return (
    <div className="min-h-screen bg-white text-slate-950">
      {faqSchema ? <JsonLd data={[faqSchema]} /> : null}
      <CinematicNavbar />

      <main>
        {/* Hero — dual audience */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <Reveal mode="mount">
              <Badge variant="secondary" className="text-sm">
                {config.flag} {t(`countryPages.${key}.badge`)}
              </Badge>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-.05em] leading-tight text-slate-950">
                {t(`countryPages.${key}.heroTitle`)}
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                {t(`countryPages.${key}.heroSubtitle`)}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
                <Link href={`/legal-issue-checker?country=${config.countryCode}`}>
                  <Button size="lg" className="w-full rounded-full sm:w-auto">
                    {t(`countryPages.${key}.consumerCta`)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/for-lawyers">
                  <Button size="lg" variant="outline" className="w-full rounded-full sm:w-auto">{t(`countryPages.${key}.firmCta`)}</Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500 max-w-xl mx-auto">
                {t(`countryPages.${key}.heroNote`)}
              </p>
            </Reveal>
          </div>
        </section>

        {/* Consumer path — no lawyer needed for clarity */}
        <section className="border-y border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Reveal className="grid lg:grid-cols-2 gap-10 items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    {t("countryPages.forIndividuals")}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-.03em] text-slate-950">
                  {t(`countryPages.${key}.consumerTitle`)}
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  {t(`countryPages.${key}.consumerBody`)}
                </p>
                <ul className="space-y-3">
                  {consumerBullets.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={`/legal-issue-checker?country=${config.countryCode}`}>
                  <Button className="rounded-full">
                    {t(`countryPages.${key}.consumerCta`)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <Card className="border-blue-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    {t("countryPages.noLawyerNeededTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 leading-relaxed space-y-3">
                  <p>{t(`countryPages.${key}.noLawyerPitch`)}</p>
                  <p className="text-slate-900 font-medium">{t("countryPages.lawyerWhenReady")}</p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* Law firm path */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Reveal className="grid lg:grid-cols-2 gap-10 items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <Briefcase className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    {t("countryPages.forLawFirms")}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-.03em] text-slate-950">
                  {t(`countryPages.${key}.firmTitle`)}
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  {t(`countryPages.${key}.firmBody`)}
                </p>
                <ul className="space-y-3">
                  {firmBullets.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/for-lawyers">
                  <Button variant="outline" className="rounded-full">
                    {t(`countryPages.${key}.firmCta`)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f5f8fd] p-6 space-y-4">
                <Scale className="h-8 w-8 text-blue-600" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t(`countryPages.${key}.firmPitch`)}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Legal guides for this country */}
        {guides.length > 0 ? (
          <section className="border-t border-slate-200 py-16 sm:py-20">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
              <Reveal className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-.03em] text-slate-950">
                  {t("countryPages.guidesTitle", { country: config.label })}
                </h2>
                <p className="text-slate-600">{t("countryPages.guidesSubtitle")}</p>
              </Reveal>
              <div className="grid sm:grid-cols-2 gap-4">
                {guides.map((guide, index) => (
                  <Reveal key={guide.slug} delay={(index % 2) * 0.06}>
                    <Link
                      href={legalGuidePath(guide.country, guide.slug)}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200 transition-colors"
                    >
                      <p className="font-medium text-slate-950">{slugToTitle(guide.slug)}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {config.label} · {t("countryPages.guideLink")}
                      </p>
                    </Link>
                  </Reveal>
                ))}
              </div>
              <div className="text-center">
                <Link href="/legal-guides">
                  <Button variant="ghost" className="rounded-full">{t("countryPages.allGuides")}</Button>
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* Other markets */}
        <section className="py-12 border-t border-slate-200">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <p className="text-sm text-slate-500">{t("countryPages.otherMarkets")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {COUNTRY_MARKET_CODES.filter((c) => c !== config.code).map((code) => {
                const other = COUNTRY_MARKETS[code]
                return (
                  <Link key={code} href={other.path}>
                    <Button variant="outline" size="sm" className="rounded-full">
                      {other.flag} {other.label}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        {faqItems.length > 0 ? (
          <section className="py-16 sm:py-20 bg-[#f5f8fd]">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-.03em] text-center text-slate-950">
                {t(`countryPages.${key}.faqTitle`)}
              </h2>
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <Reveal key={item.question} delay={index * 0.04} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-950">{item.question}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mt-2">{item.answer}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <div className="mx-auto max-w-5xl px-4 pb-16">
          <LegalDisclaimer />
        </div>
      </main>

      <CinematicFooter />
    </div>
  )
}
