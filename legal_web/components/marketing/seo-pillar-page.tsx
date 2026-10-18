import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { SectionHeading } from "@/components/marketing/section-heading"
import {
  SEO_PILLAR_CTA,
  SEO_PILLAR_SLUGS,
  isSeoPillarSlug,
  seoPillarPath,
  type SeoPillarSlug,
} from "@/lib/seo/seo-pillars"
import {
  buildFaqPageSchema,
  buildSoftwareApplicationSchema,
  type FaqItem,
} from "@/lib/seo/structured-data"
import { ArrowRight, CheckCircle, Globe, Sparkles } from "lucide-react"

interface SeoPillarPageProps {
  slug: string
}

export function generateSeoPillarStaticParams() {
  return SEO_PILLAR_SLUGS.map((slug) => ({ slug }))
}

export async function SeoPillarPage({ slug }: SeoPillarPageProps) {
  if (!isSeoPillarSlug(slug)) notFound()

  const t = await getTranslations("marketing")
  const key = slug as SeoPillarSlug
  const features = (t.raw(`seoPillars.${key}.features`) ?? []) as string[]
  const faqItems = (t.raw(`seoPillars.${key}.faqItems`) ?? []) as FaqItem[]
  const ctaPath = SEO_PILLAR_CTA[key]

  const softwareSchema = buildSoftwareApplicationSchema({
    name: `${t("siteName")} — ${t(`seoPillars.${key}.heroTitle`)}`,
    description: t(`seoPillars.${key}.metaDescription`),
  })
  const faqSchema = faqItems.length > 0 ? buildFaqPageSchema(faqItems) : null

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <JsonLd data={[softwareSchema, ...(faqSchema ? [faqSchema] : [])]} />
      <CinematicNavbar />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Globe className="h-3.5 w-3.5" />{t("seoGlobal.badge")}</p>
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl lg:text-6xl">{t(`seoPillars.${key}.heroTitle`)}</h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">{t(`seoPillars.${key}.heroSubtitle`)}</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={ctaPath}><Button size="lg" className="h-12 w-full rounded-full px-7 text-base shadow-lg shadow-blue-500/20 sm:w-auto">{t(`seoPillars.${key}.ctaPrimary`)}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
                <Link href="/for-lawyers"><Button size="lg" variant="outline" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">{t("seoGlobal.firmCta")}</Button></Link>
              </div>
              <p className="mt-5 text-sm text-slate-500">{t("seoGlobal.availability")}</p>
            </Reveal>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <Reveal className="mx-auto max-w-3xl space-y-5 px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-[-.03em] text-slate-950">{t(`seoPillars.${key}.bodyTitle`)}</h2>
            <p className="text-lg leading-8 text-slate-600">{t(`seoPillars.${key}.body1`)}</p>
            <p className="text-lg leading-8 text-slate-600">{t(`seoPillars.${key}.body2`)}</p>
          </Reveal>
        </section>

        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={t(`seoPillars.${key}.featuresSubtitle`)} title={t("seoGlobal.featuresTitle")} />
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <Reveal key={feature} delay={(index % 4) * 0.05} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <span className="text-sm leading-relaxed text-slate-700">{feature}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-950 py-16 text-white sm:py-20">
          <Reveal className="mx-auto max-w-3xl space-y-4 px-4 text-center sm:px-6 lg:px-8">
            <Sparkles className="mx-auto h-8 w-8 text-blue-300" />
            <h2 className="text-3xl font-semibold tracking-[-.03em]">{t("seoGlobal.dualAudienceTitle")}</h2>
            <p className="leading-7 text-slate-300">{t(`seoPillars.${key}.dualAudience`)}</p>
            <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
              <Link href="/legal-issue-checker"><Button className="rounded-full bg-white text-slate-950 hover:bg-blue-50">{t("seoGlobal.consumerCta")}</Button></Link>
              <Link href="/for-lawyers"><Button variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10">{t("seoGlobal.firmCta")}</Button></Link>
            </div>
          </Reveal>
        </section>

        {faqItems.length > 0 ? (
          <section className="bg-[#f5f8fd] py-16 sm:py-20">
            <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
              <h2 className="text-center text-3xl font-semibold tracking-[-.03em] text-slate-950">{t("seoGlobal.faqTitle")}</h2>
              <div className="space-y-4">
                {faqItems.map((item) => (
                  <div key={item.question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-950">{item.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-slate-200 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-5 text-center text-lg font-semibold text-slate-950">{t("seoGlobal.relatedSolutions")}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {SEO_PILLAR_SLUGS.filter((s) => s !== key)
                .slice(0, 6)
                .map((related) => (
                  <Link key={related} href={seoPillarPath(related)}><Button variant="outline" size="sm" className="rounded-full">{t(`seoPillars.${related}.shortTitle`)}</Button></Link>
                ))}
              <Link href="/solutions"><Button variant="ghost" size="sm" className="rounded-full">{t("seoGlobal.allSolutions")}</Button></Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 pb-16">
          <LegalDisclaimer />
        </div>
      </main>

      <CinematicFooter />
    </div>
  )
}
