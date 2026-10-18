import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { JsonLd } from "@/components/seo/json-ld"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"
import { LEGAL_GUIDE_STATIC_PARAMS } from "@/lib/seo/public-routes"
import { buildArticleSchema } from "@/lib/seo/structured-data"
import { ArrowRight, BookOpen } from "lucide-react"

const COUNTRY_LABELS: Record<string, string> = {
  in: "India",
  us: "United States",
  ke: "Kenya",
  gb: "United Kingdom",
}

const GUIDE_SECTIONS = [
  "Overview",
  "When to seek legal help",
  "Typical process",
  "Documents you may need",
  "Common mistakes",
  "Next steps",
]

/** Sample SEO slugs pre-rendered at build time. */
export function generateStaticParams() {
  return LEGAL_GUIDE_STATIC_PARAMS.map(({ country, slug }) => ({ country, slug }))
}

interface GuidePageProps {
  params: Promise<{ country: string; slug: string }>
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { country, slug } = await Promise.resolve(params)
  const countryKey = country.toLowerCase()
  const countryLabel = COUNTRY_LABELS[countryKey] ?? country.toUpperCase()
  const title = slugToTitle(slug)

  return buildPageMetadata({
    title: `${title} — ${countryLabel} Legal Guide`,
    description: `Plain-language legal guide for ${title.toLowerCase()} in ${countryLabel}. Educational information only — not legal advice.`,
    path: `/legal-guides/${countryKey}/${slug}`,
  }, SITE_NAME)
}

export default async function LegalGuidePage({ params }: GuidePageProps) {
  const resolved = await Promise.resolve(params)
  const countryKey = resolved.country.toLowerCase()
  const slug = resolved.slug.toLowerCase()

  if (!countryKey || !slug) {
    notFound()
  }

  const countryLabel = COUNTRY_LABELS[countryKey] ?? countryKey.toUpperCase()
  const title = slugToTitle(slug)
  const t = await getTranslations("legalGuides")
  const guidePath = `/legal-guides/${countryKey}/${slug}`
  const articleSchema = buildArticleSchema({
    title: `${title} — ${countryLabel} Legal Guide`,
    description: `Plain-language legal guide for ${title.toLowerCase()} in ${countryLabel}. Educational information only — not legal advice.`,
    path: guidePath,
    countryLabel,
  })

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <JsonLd data={articleSchema} />
      <CinematicNavbar />

      <main>
        <section className="border-b border-slate-200 bg-gradient-to-b from-[#f5f8ff] via-white to-white py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal mode="mount">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-700">{countryLabel} legal guide</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{title}</h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Educational overview of {title.toLowerCase()} in {countryLabel}. Laws vary by
                jurisdiction and facts — consult a licensed attorney for advice on your situation.
              </p>
            </Reveal>
          </div>
        </section>

        <article className="py-14 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6">
            <LegalDisclaimer />

            <div className="space-y-4">
              {GUIDE_SECTIONS.map((section, index) => (
                <Reveal key={section} delay={index * 0.04} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    {section}
                  </h2>
                  <p className="mt-3 leading-7 text-slate-600">
                    This section will be expanded with jurisdiction-specific content for{" "}
                    <strong className="text-slate-800">{title}</strong> in {countryLabel}. For now, use the free issue checker
                    to describe your situation and receive AI-guided next steps tailored to your
                    country.
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[#f5f8fd] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-semibold text-slate-950">{t("need_help_with_your_specific_situation")}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {t("ctaSubtitleWithSite", { siteName: SITE_NAME })}
                </p>
              </div>
              <Link href="/legal-issue-checker">
                <Button className="w-full rounded-full sm:w-auto">
                  {t("ctaButton")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </Reveal>
          </div>
        </article>
      </main>

      <CinematicFooter />
    </div>
  )
}
