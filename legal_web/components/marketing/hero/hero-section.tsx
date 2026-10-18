"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight, Link2, Play, ShieldCheck, Sparkles } from "lucide-react"
import { useRef } from "react"
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"
import { marketingContent } from "@/content/marketing"

export function HeroSection() {
  const reducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 20 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 20 })
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] })
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -34])
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, reducedMotion ? 1 : 0.96])

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    mouseX.set((event.clientX - bounds.left) / bounds.width - 0.5)
    mouseY.set((event.clientY - bounds.top) / bounds.height - 0.5)
  }

  const resetPointer = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden bg-[#f8fbff] pt-8 sm:pt-14">
      <motion.div
        aria-hidden
        animate={reducedMotion ? undefined : { x: [0, 22, 0], y: [0, -16, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-24 top-8 -z-10 h-[34rem] w-[34rem] rounded-full bg-blue-300/25 blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={reducedMotion ? undefined : { x: [0, -20, 0], y: [0, 18, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 -left-28 -z-10 h-[32rem] w-[32rem] rounded-full bg-sky-200/45 blur-3xl"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_35%,rgba(83,139,255,.16),transparent_30%),radial-gradient(circle_at_14%_8%,rgba(186,219,255,.4),transparent_25%)]" />
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[.96fr_1.04fr] lg:items-center lg:gap-14 lg:px-8 xl:px-12">
        <div className="py-12 lg:py-16">
          <Reveal mode="mount">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/90 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[.16em] text-blue-700 shadow-sm shadow-blue-100/70 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Intelligence for legal work
            </p>
          </Reveal>
          <Reveal mode="mount" delay={0.08}>
            <p className="mb-4 text-xs font-medium uppercase tracking-[.2em] text-slate-400">The connected legal workspace</p>
            <h1 className="max-w-3xl text-[3.35rem] font-semibold leading-[.93] tracking-[-.075em] text-slate-950 sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
              Legal work,<br /><span className="text-blue-600">finally connected.</span>
            </h1>
          </Reveal>
          <Reveal mode="mount" delay={0.16}>
            <p className="mt-7 max-w-[34rem] text-[1.05rem] leading-8 text-slate-600 sm:text-xl">
              Research, draft, review and manage legal matters with one intelligent workspace built for individuals, lawyers and law firms.
            </p>
          </Reveal>
          <Reveal mode="mount" delay={0.24} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth"><Button size="lg" className="group relative h-12 overflow-hidden rounded-full px-6 text-base shadow-xl shadow-blue-500/25 transition-transform hover:-translate-y-0.5"><span className="absolute inset-y-0 -left-14 w-12 -skew-x-12 bg-white/25 transition-transform duration-500 group-hover:translate-x-[13rem]" /><span className="relative">Start free</span><ArrowRight className="relative ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Button></Link>
            <Link href="/demo"><Button size="lg" className="h-12 rounded-full border-transparent bg-slate-900 px-6 text-base text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"><Play className="mr-2 h-4 w-4" />Book a demo</Button></Link>
          </Reveal>
          <Reveal mode="mount" delay={0.32}>
            <p className="mt-6 text-sm text-slate-500">Built for legal work. Designed around human judgment.</p>
          </Reveal>
        </div>

        <Reveal mode="mount" delay={0.18} className="relative h-[360px] sm:h-[470px] lg:h-[560px]">
          <motion.div
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
            style={{ rotateX, rotateY, y: visualY, scale: visualScale, transformPerspective: 900 }}
            className="relative h-full w-full"
          >
            <div className="absolute -inset-5 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_45%,rgba(91,150,255,.38),transparent_62%)] blur-2xl" />
            <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_35px_100px_rgba(31,83,170,.2)]">
              <Image
                src={marketingContent.images.heroCore}
                alt="An abstract illuminated canopy drawing scattered documents into one organised centre — the Umbrella Intelligence Core"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f8fbff]/25 via-transparent to-transparent" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -6, 0] }}
            transition={reducedMotion ? { duration: 0.6, delay: 0.5 } : { opacity: { duration: 0.6, delay: 0.5 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
            className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-[0_10px_30px_rgba(31,83,170,.16)] backdrop-blur-xl"
          >
            <Link2 className="h-3 w-3 text-blue-600" />
            12 sources linked
          </motion.div>
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={reducedMotion ? { opacity: 0.45 } : { opacity: [0.25, 0.65, 0.25] }}
            transition={reducedMotion ? { duration: 0.4, delay: 0.6 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[4.75rem] top-[3.25rem] h-px w-20 origin-right rotate-[146deg] bg-gradient-to-r from-transparent to-blue-200"
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -7, 0] }}
            transition={reducedMotion ? { duration: 0.6, delay: 0.35 } : { opacity: { duration: 0.6, delay: 0.35 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.2 } }}
            className="absolute bottom-5 left-5 max-w-[16rem] overflow-hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3.5 shadow-[0_20px_50px_rgba(31,83,170,.22)] backdrop-blur-xl"
          >
            <div className="absolute inset-x-4 -bottom-2 h-6 rounded-full bg-blue-400/25 blur-xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-[0_0_16px_rgba(59,130,246,.55)]">
                <Sparkles className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  {!reducedMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">Umbrella Intelligence Core</p>
                <p className="text-[11px] leading-snug text-slate-500">Scattered legal work, organised.</p>
              </div>
            </div>
          </motion.div>
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={reducedMotion ? { opacity: 0.45 } : { opacity: [0.25, 0.65, 0.25] }}
            transition={reducedMotion ? { duration: 0.4, delay: 0.55 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-[5.8rem] left-[11.5rem] h-px w-16 origin-left -rotate-[35deg] bg-gradient-to-r from-blue-200 to-transparent"
          />
        </Reveal>
      </div>
      <motion.a
        href="#product"
        aria-label="Scroll to explore Umbrella"
        animate={reducedMotion ? undefined : { y: [0, 5, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400 transition-colors hover:text-blue-600 lg:flex"
      >
        Explore the workspace <ArrowDown className="h-3.5 w-3.5" />
      </motion.a>
    </section>
  )
}
