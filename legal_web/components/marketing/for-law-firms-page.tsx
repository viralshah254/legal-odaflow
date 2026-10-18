"use client"

import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  FileCheck2,
  Landmark,
  LockKeyhole,
  Network,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { SectionHeading } from "./section-heading"

const outcomes = [
  "Standardise repeatable work without slowing lawyers down",
  "Give teams one source of truth for matters and clients",
  "See workload, deadlines and commercial performance clearly",
  "Apply firm controls across access, billing and delivery",
]

const operatingModel = [
  {
    icon: Network,
    title: "One connected firm",
    description: "Matter, client, document and financial context stays connected across teams and practice groups.",
  },
  {
    icon: Workflow,
    title: "Consistent delivery",
    description: "Turn your firm’s best processes into reusable playbooks, reviews and approval paths.",
  },
  {
    icon: BarChart3,
    title: "Operational visibility",
    description: "Bring workload, matter progress, deadlines and billing signals into a shared view.",
  },
]

const capabilities = [
  { icon: LockKeyhole, title: "Roles and permissions", description: "Control access by role, team and matter while keeping collaboration practical." },
  { icon: FileCheck2, title: "Firm-wide playbooks", description: "Standardise intake, drafting, review and delivery with reusable workflows." },
  { icon: Briefcase, title: "Matter operations", description: "Coordinate owners, tasks, documents, meetings and deadlines around each matter." },
  { icon: ReceiptText, title: "Billing controls", description: "Support time capture, pre-bill review, invoicing and trust-aware financial workflows." },
  { icon: UsersRound, title: "Client collaboration", description: "Keep updates, requests and shared documents out of fragmented email threads." },
  { icon: ShieldCheck, title: "Governance and auditability", description: "Create clearer oversight of access, approvals and AI-assisted legal work." },
]

const rollout = [
  { step: "01", title: "Map your operating model", description: "We identify practice groups, roles, workflows and the outcomes your firm needs." },
  { step: "02", title: "Configure your workspace", description: "Matter structures, permissions, templates and controls are tailored to your team." },
  { step: "03", title: "Launch with confidence", description: "Your people receive a focused rollout with support for adoption and refinement." },
]

export function ForLawFirmsPageContent() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f3f7ff] via-white to-white pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute -right-28 -top-28 h-[440px] w-[440px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-[340px] w-[340px] rounded-full bg-cyan-300/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 xl:px-12">
          <Reveal mode="mount">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700">
              <Landmark className="h-3.5 w-3.5" />
              Built for modern law firms
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl lg:text-6xl">
              Run the firm with clarity. <span className="text-blue-600">Deliver as one team.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Umbrella connects matters, people, documents, workflows and billing in one legal operating system designed for coordinated firm delivery.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full bg-blue-600 px-7 text-white hover:bg-blue-700">
                <Link href="/demo">Book a firm demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-slate-300 bg-white px-7 text-slate-800 hover:bg-slate-50">
                <Link href="/trust"><ShieldCheck className="mr-2 h-4 w-4" />Explore security</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {outcomes.map((outcome) => (
                <div key={outcome} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
                  {outcome}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal mode="mount" delay={0.12} className="rounded-[1.75rem] border border-slate-200 bg-[#07111f] p-6 text-white shadow-2xl shadow-slate-300/40 sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[.14em] text-blue-300">Firm command centre</p>
                <p className="mt-1 font-semibold">Operational overview</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Connected</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ["Active matters", "148"],
                ["Team members", "36"],
                ["Due this week", "24"],
                ["Drafts in review", "17"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[.04] p-4">
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-400/[.08] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                <Sparkles className="h-4 w-4 text-blue-300" />
                Firm workflow
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">Intake → conflict check → matter team → delivery → billing review</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <SectionHeading eyebrow="A better operating model" title="Align people, process and performance." copy="Give every team the context and controls to deliver consistently." />
          <div className="grid gap-5 md:grid-cols-3">
            {operatingModel.map(({ icon: Icon, title, description }) => (
              <Reveal key={title} mode="mount" className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <SectionHeading eyebrow="Firm capabilities" title="Control where it matters. Flex where it helps." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <Reveal key={title} mode="mount" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Icon className="h-5 w-5 text-blue-600" />
                <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Implementation" title="A rollout designed around your firm." />
          <div className="grid gap-5 md:grid-cols-3">
            {rollout.map((item) => (
              <Reveal key={item.step} mode="mount" className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-sm font-semibold text-blue-600">{item.step}</span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-4 mb-16 overflow-hidden rounded-[2rem] bg-[#07111f] sm:mx-6 lg:mx-8 xl:mx-12">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center text-white sm:py-24">
          <h2 className="text-3xl font-semibold tracking-[-.04em] sm:text-5xl">See how Umbrella fits your firm.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">Bring your workflows, team structure and priorities. We&apos;ll tailor the conversation to your operating model.</p>
          <Button asChild size="lg" className="mt-8 rounded-full bg-white px-7 text-slate-950 hover:bg-blue-50">
            <Link href="/demo">Book a personalised firm demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  )
}
