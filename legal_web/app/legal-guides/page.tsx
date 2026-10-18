import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"
import { LEGAL_GUIDE_STATIC_PARAMS, legalGuidePath } from "@/lib/seo/public-routes"
import { ArrowRight, BookOpen } from "lucide-react"

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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalGuides")
  return buildPageMetadata(
    {
      title: t("indexMetaTitle"),
      description: t("indexMetaDescription"),
      path: "/legal-guides",
    },
    SITE_NAME,
  )
}

export default async function LegalGuidesIndexPage() {
  const t = await getTranslations("legalGuides")

  const guidesByCountry = LEGAL_GUIDE_STATIC_PARAMS.reduce<
    Record<string, Array<{ country: string; slug: string }>>
  >((acc, guide) => {
    if (!acc[guide.country]) acc[guide.country] = []
    acc[guide.country]!.push(guide)
    return acc
  }, {})

  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <main>
        <section className="border-b border-slate-200 bg-gradient-to-b from-[#f5f8ff] via-white to-white py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t("indexTitle")}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t("indexDescription")}</p>
              <Link href="/legal-ai" className="mt-7 inline-block">
                <Button variant="outline" className="rounded-full">
                  Legal AI overview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </Reveal>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-5xl space-y-10 px-4 sm:px-6 lg:px-8">
            <LegalDisclaimer />

            <div className="grid gap-6 sm:grid-cols-2">
              {Object.entries(guidesByCountry).map(([country, guides], index) => (
                <Reveal key={country} delay={(index % 2) * 0.06} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {t("countryGuides", { country: COUNTRY_LABELS[country] ?? country })}
                  </h2>
                  <div className="mt-4 space-y-1">
                    {guides.map(({ slug }) => (
                      <Link
                        key={slug}
                        href={legalGuidePath(country, slug)}
                        className="flex items-center gap-2 rounded-lg py-1.5 text-sm text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        <BookOpen className="h-4 w-4 shrink-0" />
                        {slugToTitle(slug)}
                      </Link>
                    ))}
                  </div>
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
        </section>
      </main>

      <CinematicFooter />
    </div>
  )
}
