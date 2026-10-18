import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { buildSolutionsHubMetadata } from "@/lib/seo/site-metadata"
import { SEO_PILLAR_SLUGS, seoPillarPath } from "@/lib/seo/seo-pillars"
import { ArrowRight, Globe } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return buildSolutionsHubMetadata()
}

export default async function SolutionsHubPage() {
  const t = await getTranslations("marketing")

  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Globe className="h-3.5 w-3.5" />{t("solutionsHub.badge")}</p>
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t("solutionsHub.title")}</h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">{t("solutionsHub.subtitle")}</p>
              <p className="mt-4 text-sm text-slate-500">{t("seoGlobal.availability")}</p>
            </Reveal>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SEO_PILLAR_SLUGS.map((slug, index) => (
                <Reveal key={slug} delay={(index % 3) * 0.06} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-950">{t(`seoPillars.${slug}.shortTitle`)}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t(`seoPillars.${slug}.cardDescription`)}</p>
                  <Link href={seoPillarPath(slug)} className="mt-5">
                    <Button variant="outline" className="w-full rounded-full">{t("solutionsHub.learnMore")}<ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-[#f5f8fd] py-16 sm:py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <p className="text-lg leading-8 text-slate-600">{t("solutionsHub.closing")}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/legal-issue-checker"><Button size="lg" className="rounded-full">{t("seoGlobal.consumerCta")}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/for-lawyers"><Button size="lg" variant="outline" className="rounded-full">{t("seoGlobal.firmCta")}</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
    </div>
  )
}
