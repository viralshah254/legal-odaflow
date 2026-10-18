"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertCircle, ArrowRight, Check, ChevronRight, FileSearch, FileText, Layers3, ListChecks, Pause, Play, Search, ShieldCheck, UsersRound, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
import { marketingContent, type ModuleWorkspace } from "@/content/marketing"
import { AnnouncementBar } from "./announcement-bar"
import { CinematicNavbar } from "./cinematic-navbar"
import { CinematicFooter } from "./cinematic-footer"
import { HeroSection } from "./hero/hero-section"
import { SectionHeading } from "./section-heading"

function TrustStrip() {
  return <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl grid-cols-1 gap-y-4 px-4 py-6 sm:grid-cols-2 sm:gap-y-6 sm:px-6 sm:py-8 lg:grid-cols-4 lg:px-8 xl:px-12">{marketingContent.trust.map((item) => <div key={item} className="flex items-center gap-2 px-3 text-sm font-medium text-slate-600"><Check className="h-4 w-4 shrink-0 text-blue-600" />{item}</div>)}</div></section>
}

function FlowDiagram({ active }: { active: number }) {
  const modules = marketingContent.modules
  return (
    <div className="relative flex items-center justify-between">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
      <motion.div
        className="absolute left-0 top-1/2 h-px bg-gradient-to-r from-blue-400 to-sky-300"
        initial={false}
        animate={{ width: `${(active / (modules.length - 1)) * 100}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
      {modules.map((module, index) => {
        const state = index < active ? "done" : index === active ? "active" : "upcoming"
        return (
          <div key={module.id} className="relative z-10 flex flex-1 flex-col items-center gap-2">
            <motion.span
              animate={{ scale: state === "active" ? 1.18 : 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                state === "done"
                  ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                  : state === "active"
                    ? `border-transparent bg-gradient-to-br ${module.accent} text-white shadow-[0_0_18px_rgba(74,139,255,.55)]`
                    : "border-white/15 bg-[#07111f] text-slate-500"
              }`}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </motion.span>
            <span className={`hidden text-[11px] font-medium sm:block ${state === "upcoming" ? "text-slate-500" : "text-slate-200"}`}>{module.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function WorkspaceShell({ children, status = "Connected" }: { children: ReactNode; status?: string }) {
  return (
    <div className="mt-9 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/65 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-slate-400">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Umbrella workspace</span>
        <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-300">{status}</span>
      </div>
      {children}
    </div>
  )
}

function ModuleWorkspaceCard({ workspace }: { workspace: ModuleWorkspace }) {
  switch (workspace.kind) {
    case "intake":
      return (
        <WorkspaceShell status="Issue mapped">
          <div className="space-y-4 p-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[.12em] text-slate-500">Situation</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-200">{workspace.situation}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {workspace.tags.map((tag) => <span key={tag} className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-200">{tag}</span>)}
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-300"><ArrowRight className="h-3.5 w-3.5 text-sky-300" />{workspace.nextStep}</div>
          </div>
        </WorkspaceShell>
      )
    case "research":
      return (
        <WorkspaceShell status={workspace.sourceCount}>
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-violet-300/15 bg-violet-400/[.07] p-3">
              <p className="text-[11px] text-violet-200">Research question</p>
              <p className="mt-1 text-sm leading-5 text-slate-100">{workspace.query}</p>
            </div>
            <p className="text-xs leading-5 text-slate-300">{workspace.finding}</p>
            <div className="flex flex-wrap gap-2">{workspace.citations.map((citation) => <span key={citation} className="rounded-md border border-white/10 bg-white/[.05] px-2 py-1 text-[10px] text-slate-300">{citation}</span>)}</div>
          </div>
        </WorkspaceShell>
      )
    case "draft":
      return (
        <WorkspaceShell status={workspace.progress}>
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><FileText className="h-4 w-4 text-emerald-300" />{workspace.document}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {workspace.checklist.map((entry, index) => <div key={entry} className="flex items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.035] px-2.5 py-2 text-[11px] text-slate-300"><Check className={`h-3.5 w-3.5 ${index < 2 ? "text-emerald-300" : "text-slate-500"}`} />{entry}</div>)}
            </div>
          </div>
        </WorkspaceShell>
      )
    case "review":
      return (
        <WorkspaceShell status={workspace.reviewed}>
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><FileSearch className="h-4 w-4 text-amber-300" />{workspace.document}</div>
            <div className="mt-4 space-y-2">
              {workspace.flags.map((flag) => <div key={flag.label} className="flex items-center justify-between rounded-lg border border-white/[.08] bg-white/[.035] px-3 py-2.5 text-xs"><span className="flex items-center gap-2 text-slate-200"><AlertCircle className={`h-3.5 w-3.5 ${flag.severity === "high" ? "text-rose-400" : "text-amber-300"}`} />{flag.label}</span><span className={flag.severity === "high" ? "text-rose-300" : "text-amber-200"}>{flag.severity}</span></div>)}
            </div>
          </div>
        </WorkspaceShell>
      )
    case "manage":
      return (
        <WorkspaceShell status={workspace.progress}>
          <div className="p-5">
            <p className="text-sm font-medium text-slate-100">{workspace.matter}</p>
            <div className="mt-4 space-y-2">
              {workspace.tasks.map((task) => <div key={task.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-300"><span className={`flex h-4 w-4 items-center justify-center rounded border ${task.done ? "border-emerald-400/70 bg-emerald-400/15" : "border-white/25"}`}>{task.done && <Check className="h-3 w-3 text-emerald-300" />}</span>{task.label}</span><span className={task.due === "Today" ? "text-rose-300" : "text-slate-500"}>{task.due}</span></div>)}
            </div>
          </div>
        </WorkspaceShell>
      )
    case "collaborate":
      return (
        <WorkspaceShell status={workspace.status}>
          <div className="p-5">
            <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-cyan-300" /><div className="flex -space-x-2">{workspace.people.map((person) => <span key={person.initials} title={person.name} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 text-[10px] font-semibold text-white ${person.color}`}>{person.initials}</span>)}</div><span className="text-xs text-slate-400">{workspace.people.length} people connected</span></div>
            <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-400/[.07] p-3 text-sm leading-5 text-slate-200">{workspace.handoff}</div>
          </div>
        </WorkspaceShell>
      )
  }
}

function OperatingSystem() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const stepCount = marketingContent.modules.length
  const item = marketingContent.modules[active]

  useEffect(() => {
    let reverted = false
    let context: { revert: () => void } | undefined
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, triggerModule]) => {
      if (reverted || !sectionRef.current) return
      const gsap = gsapModule.gsap
      const ScrollTrigger = triggerModule.ScrollTrigger
      gsap.registerPlugin(ScrollTrigger)
      context = gsap.context(() => {
        ScrollTrigger.matchMedia({
          "(min-width: 1024px)": () => ScrollTrigger.create({
            trigger: sectionRef.current,
            start: "top top",
            end: `+=${(stepCount - 1) * 560}`,
            pin: true,
            pinSpacing: true,
            scrub: 0.6,
            snap: { snapTo: 1 / (stepCount - 1), duration: 0.4, ease: "power1.inOut" },
            onUpdate: (self) => setActive(Math.round(self.progress * (stepCount - 1))),
          }),
          "(max-width: 1023px)": () => ScrollTrigger.create({
            trigger: sectionRef.current,
            start: "top 45%",
            end: "bottom 55%",
            onUpdate: (self) => setActive(Math.min(stepCount - 1, Math.floor(self.progress * stepCount))),
          }),
        })
      }, sectionRef)
    })
    return () => { reverted = true; context?.revert() }
  }, [stepCount])

  return (
    <section ref={sectionRef} id="product" className="relative flex min-h-screen items-center overflow-hidden bg-[#07111f] py-16 text-white sm:py-20 lg:py-24">
      <Image
        src={marketingContent.images.networkBackdrop}
        alt=""
        fill
        aria-hidden
        className="pointer-events-none select-none object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#07111f] via-[#07111f]/70 to-[#07111f]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <SectionHeading tone="light" eyebrow="The Umbrella operating system" title="One workspace for the entire legal journey." copy="Six connected stages. Scroll through them one at a time—context carries forward at every step." />
        <div className="grid gap-8 lg:grid-cols-[.62fr_1.38fr] lg:items-start">
          <div className="relative flex flex-col gap-1.5">
            <div className="pointer-events-none absolute left-[27px] top-6 bottom-6 w-px bg-white/10" />
            {marketingContent.modules.map((module, index) => {
              const state = index < active ? "done" : index === active ? "active" : "upcoming"
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActive(index)}
                  className="group relative overflow-hidden rounded-xl px-3 py-3 text-left transition"
                >
                  {state === "active" && (
                    <motion.span
                      layoutId="os-step-highlight"
                      className={`absolute inset-0 rounded-xl border border-blue-400/60 bg-gradient-to-br ${module.accent} opacity-[.16]`}
                      transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    />
                  )}
                  <span className="relative flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                      state === "done"
                        ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                        : state === "active"
                          ? "border-blue-300 bg-blue-400/25 text-white"
                          : "border-white/15 bg-[#07111f] text-slate-500 group-hover:border-white/30 group-hover:text-slate-300"
                    }`}>
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className={`font-medium transition-colors ${state === "upcoming" ? "text-slate-400 group-hover:text-slate-200" : "text-white"}`}>{module.label}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative min-h-[460px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[.04] p-6 shadow-2xl sm:p-10">
            <div className={`absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br ${item.accent} opacity-25 blur-3xl transition-colors duration-500`} />
            <FlowDiagram active={active} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={item.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative mt-10">
                <p className="text-sm font-medium text-blue-200">{item.eyebrow}</p>
                <h3 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-.05em]">{item.title}</h3>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">{item.description}</p>
                <ModuleWorkspaceCard workspace={item.workspace} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

function ProductFilm() {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [open, setOpen] = useState(false)
  const loopRef = useRef<HTMLVideoElement>(null)
  const modalRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = useReducedMotion()
  useEffect(() => { if (!reducedMotion && playing) loopRef.current?.play().catch(() => setPlaying(false)); else loopRef.current?.pause() }, [playing, reducedMotion])
  useEffect(() => {
    if (open) modalRef.current?.play().catch(() => {})
    else { loopRef.current?.pause(); setPlaying(false) }
  }, [open])
  return (
    <section className="bg-[#f2f6fc] py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <SectionHeading eyebrow="Inside Umbrella" title="Watch legal work become connected." copy="A real walkthrough of the workspace—research, drafting, review and matters, in one place." />
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl">
          <video ref={loopRef} muted={muted} loop playsInline preload="none" poster={marketingContent.video.poster} className="aspect-video w-full object-cover">
            <source src={marketingContent.video.filmMp4} type="video/mp4" />
          </video>
          <div className={`absolute inset-0 flex flex-col items-center justify-center text-center text-white transition-opacity duration-500 ${playing ? "pointer-events-none opacity-0" : "bg-[radial-gradient(circle_at_50%_45%,rgba(63,135,255,.28),rgba(7,17,31,.55)_60%,rgba(7,17,31,.82))] opacity-100"}`}>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-200">Product film</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">How Umbrella works</h3>
            <p className="mt-4 max-w-md text-slate-300">Straight from the product—no staged footage.</p>
            <Button onClick={() => setOpen(true)} className="mt-7 rounded-full bg-white text-slate-950 hover:bg-blue-50"><Play className="mr-2 h-4 w-4" />Watch with sound</Button>
          </div>
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute preview" : "Mute preview"}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Umbrella product film" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-black">
                <Button size="icon" variant="secondary" className="absolute right-3 top-3 z-10 rounded-full" onClick={() => setOpen(false)} aria-label="Close film"><X /></Button>
                <video ref={modalRef} controls muted playsInline poster={marketingContent.video.poster} className="aspect-video w-full">
                  <source src={marketingContent.video.filmMp4} type="video/mp4" />
                  <track kind="captions" srcLang="en" label="English" />
                </video>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function FeatureStories() {
  const featureIcons: Record<string, typeof Search> = { search: Search, file: FileText, shield: ShieldCheck, layers: Layers3, check: ListChecks }
  return (
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:space-y-20 sm:px-6 lg:space-y-24 lg:px-8 xl:px-12">
        <SectionHeading eyebrow="Product stories" title="Designed for the work between the big decisions." />
        {marketingContent.features.map((feature, index) => {
          const Icon = featureIcons[feature.icon] ?? FileText
          return (
            <Reveal key={feature.id}>
              <article className={`grid gap-6 sm:gap-8 lg:grid-cols-2 lg:items-center ${index % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                <div>
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-blue-700">{feature.eyebrow}</p>
                  <h3 className="mt-4 text-3xl font-semibold tracking-[-.05em] text-slate-950 sm:text-4xl lg:text-5xl lg:tracking-[-.055em]">{feature.title}</h3>
                  <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{feature.description}</p>
                  <Link href="/auth" className="mt-6 inline-flex items-center text-sm font-semibold text-blue-700">{feature.cta}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </div>
                <div className="relative min-h-[260px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-5 shadow-xl shadow-slate-200/50 sm:min-h-[320px]">
                  <div className={`absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gradient-to-br ${feature.accent} opacity-25 blur-3xl`} />
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
                      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-blue-600" />{feature.eyebrow} workspace</span>
                      <span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" /></span>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className={`h-3 w-2/3 rounded-full bg-gradient-to-r ${feature.accent} opacity-80`} />
                      <div className="h-2.5 w-full rounded-full bg-slate-100" />
                      <div className="h-2.5 w-5/6 rounded-full bg-slate-100" />
                      <div className="h-2.5 w-3/4 rounded-full bg-slate-100" />
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs font-medium text-blue-700"><ShieldCheck className="h-3.5 w-3.5" />Context linked</div>
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Human review</div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

function AudienceAndWorkflow() {
  return <><section id="individuals" className="bg-slate-950 py-16 text-white sm:py-24 lg:py-32"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12"><SectionHeading tone="light" eyebrow="Built around people" title="Different legal work. One Umbrella." copy="Choose the experience that fits the work in front of you." /><div className="grid gap-4 lg:grid-cols-3">{marketingContent.audiences.map((audience) => <article key={audience.id} className="rounded-2xl border border-white/10 bg-white/[.05] p-6"><Layers3 className="h-7 w-7 text-blue-300" /><h3 className="mt-6 text-2xl font-semibold sm:mt-8">{audience.title}</h3><p className="mt-3 leading-7 text-slate-300 sm:min-h-[72px]">{audience.description}</p><ul className="mt-6 space-y-3 text-sm text-slate-200">{audience.points.map((point) => <li key={point} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-blue-300" />{point}</li>)}</ul><Link href={audience.href} className="mt-8 inline-flex items-center text-sm font-semibold text-white">{audience.cta}<ChevronRight className="h-4 w-4" /></Link></article>)}</div></div></section><section className="py-16 sm:py-24 lg:py-32"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12"><SectionHeading eyebrow="One connected flow" title="From a legal question to client delivery." copy="Each stage carries the context forward, so legal work feels like one workspace—not a chain of separate tools." /><div className="flex flex-wrap justify-center gap-2">{marketingContent.workflow.map((stage, index) => <div key={stage} className="flex items-center gap-2"><button className="rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 sm:px-4 sm:py-3">{stage}</button>{index < marketingContent.workflow.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />}</div>)}</div></div></section></>
}

function TrustAndFinalCta() {
  return <><section id="security" className="border-y border-slate-200 bg-[#f5f8fd] py-16 sm:py-24 lg:py-32"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12"><SectionHeading eyebrow="Trust, without theatre" title="Serious about the work you trust us with." copy="We only make claims we can stand behind." /><div className="grid gap-4 md:grid-cols-3">{marketingContent.security.map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6"><ShieldCheck className="h-6 w-6 text-blue-600" /><h3 className="mt-6 font-semibold text-slate-950">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>{!item.verified && <p className="mt-4 text-xs font-medium text-amber-700">Verification pending</p>}</article>)}</div></div></section><section className="relative overflow-hidden bg-[#07111f] py-20 text-center text-white sm:py-28 lg:py-36"><Image src={marketingContent.images.heroCoreCalm} alt="" fill aria-hidden className="pointer-events-none select-none object-cover opacity-45" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(45,111,233,.5),transparent_45%)]" /><div className="absolute inset-0 bg-gradient-to-b from-[#07111f]/60 via-transparent to-[#07111f]" /><div className="relative mx-auto max-w-3xl px-4"><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-200">Umbrella by OkayLegal.ai</p><h2 className="mt-5 text-4xl font-semibold tracking-[-.05em] sm:text-5xl lg:text-7xl lg:tracking-[-.06em]">Your legal work.<br /><span className="text-blue-300">Under one Umbrella.</span></h2><p className="mt-6 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">Understand issues, conduct research, draft documents and manage matters from one connected workspace.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth"><Button size="lg" className="rounded-full bg-white text-slate-950 hover:bg-blue-50">Start free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link><Link href="/demo"><Button size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10">Book a demo</Button></Link></div></div></section></>
}

export default function CinematicHomePage() {
  return <div className="min-h-screen bg-white text-slate-950"><SmoothScroll /><AnnouncementBar /><CinematicNavbar /><main><HeroSection /><TrustStrip /><OperatingSystem /><ProductFilm /><FeatureStories /><AudienceAndWorkflow /><TrustAndFinalCta /></main><CinematicFooter /></div>
}
