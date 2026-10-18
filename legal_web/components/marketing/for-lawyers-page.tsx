"use client"

import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  Clock,
  CreditCard,
  FileText,
  Mic,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { SectionHeading } from "./section-heading"

const trust = ["No credit card required", "30-day free trial", "Setup in minutes", "Deep IN/US/KE/UK · global best-effort"]

const steps = [
  { num: "01", icon: Mic, title: "Capture the work as it happens", desc: "Meeting notes, calls and intake turn into structured matter context automatically." },
  { num: "02", icon: Briefcase, title: "Organise around the matter", desc: "Documents, deadlines, tasks and client communication stay connected to the work." },
  { num: "03", icon: BarChart3, title: "Deliver with confidence", desc: "Draft, review, bill and report from one connected workspace—no tool-switching." },
]

const impacts = [
  { value: "6+ hrs", label: "Saved per week on admin" },
  { value: "3x", label: "Faster first drafts" },
  { value: "100%", label: "Matter context in one place" },
  { value: "0", label: "Tools to reconcile" },
]

const features = [
  { icon: Clock, title: "Deadline intelligence", desc: "Automatic limitation and hearing deadlines, tracked against every matter.", accent: "from-sky-500 to-blue-600" },
  { icon: FileText, title: "Matter workspace", desc: "Every document, note and task lives with the matter it belongs to.", accent: "from-violet-500 to-indigo-600" },
  { icon: Shield, title: "Trust accounting", desc: "Client funds, billing and ledgers handled with an auditable trail.", accent: "from-emerald-500 to-teal-600" },
  { icon: Users, title: "Client portal", desc: "Share updates and documents without another email thread.", accent: "from-amber-500 to-orange-600" },
  { icon: Zap, title: "Workflow automation", desc: "Repeatable playbooks handle the busywork around every matter.", accent: "from-rose-500 to-pink-600" },
  { icon: Sparkles, title: "Matter-aware Copilot", desc: "An assistant that already knows the facts, parties and history.", accent: "from-cyan-500 to-blue-600" },
  { icon: BookOpen, title: "Cited legal research", desc: "Move from question to source-linked authority in one workspace.", accent: "from-fuchsia-500 to-purple-600" },
  { icon: Mic, title: "Meeting capture", desc: "Calls and meetings become transcripts, notes and action items.", accent: "from-lime-500 to-emerald-600" },
  { icon: CreditCard, title: "Automated billing", desc: "Time capture, pre-bill review and invoicing without manual entry.", accent: "from-orange-500 to-red-600" },
]

const personas = [
  { title: "New practice", badge: "Start", desc: "Build an organised practice from the first matter.", points: ["Professional client intake", "Simple matter setup", "No IT overhead"] },
  { title: "Independent lawyer", badge: "Solo", desc: "Run your whole practice without a back office.", points: ["One workspace for every matter", "Automated billing and reminders", "More time for legal work"] },
  { title: "Specialist counsel", badge: "Expert", desc: "Keep complex work structured without adding tool sprawl.", points: ["Source-linked research", "Matter-aware drafting", "Clear client collaboration"] },
]

export function ForLawyersPageContent() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f5f8ff] via-white to-white pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pb-32">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-[320px] w-[320px] rounded-full bg-sky-300/15 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8 xl:px-12">
          <Reveal mode="mount">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Sparkles className="h-3.5 w-3.5" />Built for independent lawyers</p>
            <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl lg:text-6xl lg:tracking-[-.055em]">Run your practice.<br /><span className="text-blue-600">Not your paperwork.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">Umbrella brings matter management, drafting, research and billing into one calm workspace for independent legal practice.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth"><Button size="lg" className="h-12 w-full rounded-full px-7 text-base shadow-lg shadow-blue-500/20 sm:w-auto">Start free trial<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/demo"><Button size="lg" className="h-12 w-full rounded-full border-transparent bg-slate-900 px-7 text-base text-white hover:bg-slate-800 sm:w-auto"><Zap className="mr-2 h-4 w-4" />Book a walkthrough</Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {trust.map((item) => <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-600"><Check className="h-4 w-4 text-blue-600" />{item}</div>)}
            </div>
          </Reveal>

          <Reveal mode="mount" delay={0.15} className="hidden lg:block">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 shadow-2xl shadow-slate-300/40">
              <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 opacity-25 blur-3xl" />
              <div className="relative flex items-center justify-between border-b border-white/10 pb-4 text-xs text-slate-400">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Umbrella · Practice overview</span>
                <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-300">Live</span>
              </div>
              <div className="relative grid grid-cols-2 gap-3 pt-5">
                {[{ icon: Briefcase, label: "Active matters", value: "24" }, { icon: Clock, label: "Due today", value: "8" }, { icon: Users, label: "Clients", value: "142" }, { icon: BarChart3, label: "Revenue", value: "↑ 12%" }].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[.04] p-4">
                    <stat.icon className="h-4 w-4 text-blue-300" />
                    <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-blue-400/15 bg-blue-400/[.06] px-3 py-2.5 text-xs text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Native meeting capture → transcript → AI notes → auto timeline
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 xl:px-12">
          <SectionHeading eyebrow="How it works" title="From first meeting to matter delivery." />
          <div className="relative grid gap-10 md:grid-cols-3">
            <div className="absolute top-10 left-1/3 right-1/3 hidden h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent md:block" aria-hidden />
            {steps.map((step, index) => (
              <Reveal key={step.num} delay={index * 0.08} className="relative flex flex-col items-center text-center">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50"><step.icon className="h-8 w-8 text-blue-600" /></div>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f5f8fd] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:px-6 lg:grid-cols-4 lg:px-8 xl:px-12">
          {impacts.map((impact) => (
            <div key={impact.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-4xl font-semibold tracking-[-.03em] text-blue-700 sm:text-5xl">{impact.value}</p>
              <p className="mt-2 text-sm text-slate-600">{impact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <SectionHeading eyebrow="Everything, connected" title="Every tool your practice needs." copy="Deeply integrated into one workspace—not bolted on." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={(index % 3) * 0.06} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-lg`}><feature.icon className="h-5 w-5" /></div>
                <h3 className="mt-5 text-base font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <SectionHeading tone="light" eyebrow="Built for independent practice" title="A workspace that grows with your career." />
          <div className="grid gap-4 md:grid-cols-3">
            {personas.map((persona) => (
              <article key={persona.title} className="rounded-2xl border border-white/10 bg-white/[.05] p-6">
                <span className="inline-flex rounded-full bg-blue-400/15 px-3 py-1 text-xs font-semibold text-blue-200">{persona.badge}</span>
                <h3 className="mt-5 text-2xl font-semibold">{persona.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{persona.desc}</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-200">
                  {persona.points.map((point) => <li key={point} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-blue-300" />{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-[-.03em] text-slate-950 sm:text-3xl">Simple pricing, built to scale with your practice.</h2>
              <p className="mt-2 text-slate-600">Start free. Upgrade only when your practice needs more.</p>
            </div>
            <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6"><p className="text-lg font-semibold text-slate-950">Starter</p><p className="mt-1.5 text-sm text-slate-600">For solo practitioners getting organised.</p></div>
              <div className="rounded-xl border border-slate-200 p-6"><p className="text-lg font-semibold text-slate-950">Professional</p><p className="mt-1.5 text-sm text-slate-600">For established, high-volume practices.</p></div>
            </div>
            <div className="mt-8 flex justify-center">
              <Link href="/pricing"><Button size="lg" variant="outline" className="rounded-full">See full pricing<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-4 mb-16 overflow-hidden rounded-[2rem] bg-[#07111f] sm:mx-6 lg:mx-8 xl:mx-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(45,111,233,.45),transparent_55%)]" />
        <div className="relative mx-auto max-w-2xl px-6 py-16 text-center text-white sm:py-24">
          <h2 className="text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Ready to run a calmer practice?</h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">Join lawyers who spend less time on admin and more time on the work that matters.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth"><Button size="lg" className="rounded-full bg-white text-slate-950 hover:bg-blue-50">Start free trial<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link href="/demo"><Button size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10">Book a demo</Button></Link>
          </div>
        </div>
      </section>
    </>
  )
}
