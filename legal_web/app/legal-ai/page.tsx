import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { SectionHeading } from "@/components/marketing/section-heading"
import { Reveal } from "@/components/motion/reveal"
import { JsonLd } from "@/components/seo/json-ld"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { Button } from "@/components/ui/button"
import { buildLegalAiMetadata } from "@/lib/seo/site-metadata"
import { LEGAL_GUIDE_STATIC_PARAMS, legalGuidePath } from "@/lib/seo/public-routes"
import {
  buildFaqPageSchema,
  buildSoftwareApplicationSchema,
  type FaqItem,
} from "@/lib/seo/structured-data"
import { ArrowRight, BookOpen, CheckCircle, Scale, Sparkles, Users } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return buildLegalAiMetadata()
}

type Pillar = { title: string; body: string }
type UseCase = { audience: string; title: string; items: string[] }

const COUNTRY_LABELS: Record<string, string> = {
  in: "India",
  us: "United States",
  ke: "Kenya",
  gb: "United Kingdom",
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default async function LegalAiPage() {
  const t = await getTranslations("marketing")
  const pillars = (t.raw("legalAi.pillars") ?? []) as Pillar[]
  const useCases = (t.raw("legalAi.useCases") ?? []) as UseCase[]
  const faqItems = (t.raw("legalAi.faqItems") ?? []) as FaqItem[]

  const softwareSchema = buildSoftwareApplicationSchema({
    name: `${t("siteName")} — Legal AI`,
    description: t("legalAi.metaDescription"),
  })
  const faqSchema = faqItems.length > 0 ? buildFaqPageSchema(faqItems) : null

  const guidesByCountry = LEGAL_GUIDE_STATIC_PARAMS.reduce<
    Record<string, Array<{ country: string; slug: string }>>
  >((acc, guide) => {
    if (!acc[guide.country]) acc[guide.country] = []
    acc[guide.country]!.push(guide)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <JsonLd data={[softwareSchema, ...(faqSchema ? [faqSchema] : [])]} />
      <CinematicNavbar />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Sparkles className="h-3.5 w-3.5" />{t("legalAi.badge")}</p>
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl lg:text-6xl">{t("legalAi.heroTitle")}</h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">{t("legalAi.heroSubtitle")}</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/legal-issue-checker"><Button size="lg" className="h-12 w-full rounded-full px-7 text-base shadow-lg shadow-blue-500/20 sm:w-auto">{t("legalAi.heroCtaPrimary")}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
                <Link href="/for-lawyers"><Button size="lg" variant="outline" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">{t("legalAi.heroCtaSecondary")}</Button></Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <Reveal className="mx-auto max-w-3xl space-y-5 px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-[-.03em] text-slate-950">{t("legalAi.whatIsTitle")}</h2>
            <p className="text-lg leading-8 text-slate-600">{t("legalAi.whatIsBody1")}</p>
            <p className="text-lg leading-8 text-slate-600">{t("legalAi.whatIsBody2")}</p>
          </Reveal>
        </section>

        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={t("legalAi.differentSubtitle")} title={t("legalAi.differentTitle")} />
            <div className="grid gap-5 sm:grid-cols-2">
              {pillars.map((pillar, index) => (
                <Reveal key={pillar.title} delay={(index % 2) * 0.06} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2.5"><CheckCircle className="h-5 w-5 shrink-0 text-blue-600" /><h3 className="text-lg font-semibold text-slate-950">{pillar.title}</h3></div>
                  <p className="mt-3 leading-7 text-slate-600">{pillar.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={t("legalAi.useCasesSubtitle")} title={t("legalAi.useCasesTitle")} />
            <div className="grid gap-6 md:grid-cols-2">
              {useCases.map((uc, index) => (
                <Reveal key={uc.audience} delay={index * 0.08} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {uc.audience === "Individuals" ? <Users className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
                    {uc.audience}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">{uc.title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {uc.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{item}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">{t("legalAi.compareTitle")}</h2>
              <p className="mt-2.5 text-slate-600">{t("legalAi.compareSubtitle")}</p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <Link href="/solutions/legal-document-drafting"><Button variant="outline" className="w-full rounded-full sm:w-auto">Document Drafting</Button></Link>
                <Link href="/solutions/contract-review"><Button variant="outline" className="w-full rounded-full sm:w-auto">Contract Review</Button></Link>
                <Link href="/solutions"><Button variant="outline" className="w-full rounded-full sm:w-auto">{t("legalAi.compareLink")}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">{t("legalAi.guidesTitle")}</h2>
              <p className="mt-2.5 text-slate-600">{t("legalAi.guidesSubtitle")}</p>
              <div className="mt-5 space-y-5">
                {Object.entries(guidesByCountry).map(([country, guides]) => (
                  <div key={country}>
                    <p className="mb-2 text-sm font-semibold text-slate-950">{COUNTRY_LABELS[country] ?? country}</p>
                    <ul className="space-y-1.5">
                      {guides.map(({ slug }) => (
                        <li key={slug}>
                          <Link href={legalGuidePath(country, slug)} className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
                            <BookOpen className="h-3.5 w-3.5" />{slugToTitle(slug)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Link href="/legal-guides" className="mt-5 inline-flex items-center text-sm font-semibold text-blue-700">{t("legalAi.guidesLink")}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="border-t border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-semibold tracking-[-.03em] text-slate-950">{t("legalAi.faqTitle")}</h2>
            <div className="space-y-4">
              {faqItems.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
                </div>
              ))}
            </div>
            <LegalDisclaimer />
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-[-.03em] text-slate-950">{t("legalAi.finalCtaTitle")}</h2>
            <p className="mt-3 text-lg text-slate-600">{t("legalAi.finalCtaSubtitle")}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/legal-issue-checker"><Button size="lg" className="rounded-full">{t("legalAi.finalCtaPrimary")}</Button></Link>
              <Link href="/for-lawyers"><Button size="lg" variant="outline" className="rounded-full">{t("legalAi.finalCtaSecondary")}</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
    </div>
  )
}
