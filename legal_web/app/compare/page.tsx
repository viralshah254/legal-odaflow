import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { buildCompareHubMetadata } from "@/lib/seo/site-metadata"
import { ArrowRight, Sparkles } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return buildCompareHubMetadata()
}

export default async function CompareHubPage() {
  const t = await getTranslations("marketing")
  const cards = (t.raw("compareHub.cards") ?? []) as Array<{
    slug: string
    title: string
    description: string
  }>

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-20">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Sparkles className="h-3.5 w-3.5" />{t("compareHub.badge")}</p>
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t("compareHub.title")}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t("compareHub.subtitle")}</p>
            </Reveal>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.map((card, index) => (
                <Reveal key={card.slug} delay={(index % 2) * 0.06} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-blue-200">
                  <h3 className="text-lg font-semibold text-slate-950">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{card.description}</p>
                  <Link href={`/compare/${card.slug}`} className="mt-5">
                    <Button variant="outline" className="w-full rounded-full">
                      {t("compareHub.readComparison")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.12} className="mt-10 text-center">
              <Link href="/legal-issue-checker">
                <Button size="lg" className="rounded-full">
                  {t("compareHub.cta")}
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
