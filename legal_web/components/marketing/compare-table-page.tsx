import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Sparkles, X } from "lucide-react"

export type CompareRow = { feature: string; umbrella: string; competitor: string }

interface CompareTablePageProps {
  /** Namespace key under marketing, e.g. "compareHarvey" */
  namespace: "compareChatGpt" | "compareHarvey" | "compareLegora" | "compareLucio"
  competitorLabelKey: "chatgptLabel" | "harveyLabel" | "legoraLabel" | "lucioLabel"
}

export async function CompareTablePage({ namespace, competitorLabelKey }: CompareTablePageProps) {
  const t = await getTranslations("marketing")
  const rows = (t.raw(`${namespace}.rows`) ?? []) as CompareRow[]
  const competitorLabel = t(`${namespace}.${competitorLabelKey}`)

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white py-16 sm:py-20">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal mode="mount">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Sparkles className="h-3.5 w-3.5" />{t(`${namespace}.badge`)}</p>
              <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t(`${namespace}.title`)}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t(`${namespace}.subtitle`)}</p>
            </Reveal>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Reveal className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#f5f8fd]">
                    <th className="w-1/4 p-4 text-left font-semibold text-slate-950">Feature</th>
                    <th className="w-[37.5%] p-4 text-left font-semibold text-blue-700">{t(`${namespace}.umbrellaLabel`)}</th>
                    <th className="w-[37.5%] p-4 text-left font-semibold text-slate-500">{competitorLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-[#f9fafc]"}>
                      <td className="p-4 align-top font-medium text-slate-950">{row.feature}</td>
                      <td className="p-4 align-top">
                        <span className="flex items-start gap-2 text-slate-800"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{row.umbrella}</span>
                      </td>
                      <td className="p-4 align-top">
                        <span className="flex items-start gap-2 text-slate-500"><X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />{row.competitor}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>

            <Reveal delay={0.08} className="mt-8 rounded-2xl border border-slate-200 bg-[#f5f8fd] p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">{t(`${namespace}.verdictTitle`)}</h2>
              <p className="mt-3 leading-7 text-slate-600">{t(`${namespace}.verdictBody`)}</p>
            </Reveal>

            <div className="mt-8"><LegalDisclaimer /></div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/legal-issue-checker"><Button size="lg" className="w-full rounded-full sm:w-auto">{t(`${namespace}.cta`)}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/compare"><Button size="lg" variant="outline" className="w-full rounded-full sm:w-auto">{t("compareHub.title")}</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
    </div>
  )
}
