"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Calendar, Check, ChevronLeft, ChevronRight, Clock3, Info, Shield, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import {
  DEMO_DISCLAIMER,
  DEMO_TOUR_STEPS,
  DEMO_SAMPLE_MATTER,
  DEMO_SAMPLE_DOCUMENT,
  DEMO_SAMPLE_INVOICE,
} from "@/lib/demo/sample-data"
import { RequestDemoForm } from "@/components/marketing/request-demo-form"

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[.1em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-100 ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  )
}

export function DemoPageContent() {
  const [step, setStep] = useState(0)
  const current = DEMO_TOUR_STEPS[step]

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f3f7ff] via-white to-white py-12 sm:py-16 lg:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-cyan-300/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8">
          <Reveal mode="mount" className="pt-2 lg:sticky lg:top-28 lg:pt-8">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Personalised product demo
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl lg:text-6xl">
              See how Umbrella fits your practice.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Tell us what your team needs. We&apos;ll show you a focused walkthrough of the workflows that matter to your firm.
            </p>

            <ul className="mt-7 space-y-3.5 text-sm text-slate-700 sm:text-base">
              {[
                "A walkthrough tailored to your firm and jurisdiction",
                "Answers on onboarding, security and implementation",
                "No commitment and no generic sales presentation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-600" />We reply within one business day</span>
              <a href="#product-tour" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800">
                Explore the product tour <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </Reveal>

          <div id="request-demo" className="scroll-mt-24">
            <Reveal mode="mount" delay={0.08} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/60 sm:p-8 lg:p-10">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                  <Calendar className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-.03em] text-slate-950 sm:text-3xl">Book your personalised demo</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">Share a few details and our team will arrange a time that works for you.</p>
                </div>
              </div>
              <div className="mt-7"><RequestDemoForm /></div>
              <p className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                Your details are used only to arrange and tailor your demo. We never sell your information.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="product-tour" className="scroll-mt-24 bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal mode="mount" className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-700">Explore at your own pace</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">A quick look inside Umbrella</h2>
            <p className="mt-4 leading-7 text-slate-600">Preview the connected journey from first legal question to matter delivery and billing.</p>
          </Reveal>

          <div className="mb-6 flex items-center justify-center gap-0.5" aria-label="Product tour steps">
            {DEMO_TOUR_STEPS.map((s, i) => (
              <button key={s.id} type="button" onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? "step" : undefined} className="flex h-11 items-center justify-center px-1.5">
                <span className={`block h-2 rounded-full transition-all ${i === step ? "w-8 bg-blue-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="bg-[#07111f] p-6 text-white sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-blue-300">Step {step + 1} of {DEMO_TOUR_STEPS.length}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{current.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{current.description}</p>
              <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-400/[.08] px-4 py-3 text-sm font-medium text-blue-100">{current.highlight}</div>

              {current.id === "matter" && (
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <DataRow label="Reference" value={DEMO_SAMPLE_MATTER.ref} mono />
                  <DataRow label="Client" value={DEMO_SAMPLE_MATTER.client} />
                  <DataRow label="Stage" value={DEMO_SAMPLE_MATTER.stage} />
                  <DataRow label="Owner" value={DEMO_SAMPLE_MATTER.owner} />
                </div>
              )}
              {current.id === "document" && (
                <div className="mt-5 grid gap-2.5">
                  <DataRow label="Document code" value={DEMO_SAMPLE_DOCUMENT.code} mono />
                  <DataRow label="Name" value={DEMO_SAMPLE_DOCUMENT.name} />
                  <DataRow label="Version" value={`v${DEMO_SAMPLE_DOCUMENT.version}`} />
                </div>
              )}
              {current.id === "billing" && (
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <DataRow label="Invoice" value={DEMO_SAMPLE_INVOICE.number} mono />
                  <DataRow label="Amount" value={DEMO_SAMPLE_INVOICE.amount} />
                  <DataRow label="Trust balance" value={DEMO_SAMPLE_INVOICE.trustBalance} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 sm:p-6">
              <Button variant="outline" className="rounded-full" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
              {step < DEMO_TOUR_STEPS.length - 1 ? (
                <Button className="rounded-full" onClick={() => setStep((s) => s + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
              ) : (
                <Button asChild className="rounded-full">
                  <a href="#request-demo">Book your demo<ArrowRight className="ml-1 h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{DEMO_DISCLAIMER}</span>
          </div>

          <Reveal mode="mount" delay={0.08} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Shield className="h-4 w-4" /></span>
              <div>
                <h3 className="font-semibold text-slate-950">Prefer to explore on your own?</h3>
                <p className="mt-1 text-sm text-slate-600">Create an account and start with your own workspace.</p>
              </div>
            </div>
            <div className="mt-4 flex shrink-0 flex-wrap gap-2.5 sm:mt-0">
              <Button asChild className="rounded-full"><Link href="/auth">Start free<ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white text-slate-800 hover:bg-slate-50"><Link href="/for-law-firms">For law firms</Link></Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
