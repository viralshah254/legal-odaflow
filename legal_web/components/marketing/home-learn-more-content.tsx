"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Shield,
  Sparkles,
  Upload,
  Users,
  Building2,
  Star,
} from "lucide-react"

const SiteHeader = dynamic(
  () => import("@/components/marketing/site-header").then((m) => m.SiteHeader),
  { loading: () => <div className="h-16" /> },
)
const SiteFooter = dynamic(
  () => import("@/components/marketing/site-footer").then((m) => m.SiteFooter),
  { loading: () => <div className="h-24" /> },
)

const FEATURE_HREFS = [
  "/auth",
  "/auth",
  "/auth",
  "/for-lawyers",
  "/auth",
  "/for-lawyers",
] as const

type NumberedFeature = {
  num: string
  label: string
  title: string
  desc: string
  cta: string
}

type Testimonial = {
  quote: string
  name: string
  role: string
  flag?: string
}

type WhyNotItem = {
  name: string
  problem: string
  solution: string
}

type FaqItem = {
  question: string
  answer: string
}

type TrustItem = {
  title: string
  desc: string
}

export default function HomeLearnMoreContent() {
  const t = useTranslations("marketing.home")
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const audienceItems = (t.raw("audienceItems") ?? []) as string[]
  const numberedFeatures = (t.raw("platform.features") ?? []) as NumberedFeature[]
  const whyNotItems = (t.raw("whyNot.items") ?? []) as WhyNotItem[]
  const testimonials = (t.raw("testimonials.items") ?? []) as Testimonial[]
  const faqs = (t.raw("faq.items") ?? []) as FaqItem[]
  const trustItems = (t.raw("trust.items") ?? []) as TrustItem[]

  const marqueeItems = [...audienceItems, ...audienceItems]

  const howItWorksSteps = [
    { step: "1", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
    { step: "2", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
    { step: "3", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
    { step: "4", title: t("howItWorks.step4Title"), desc: t("howItWorks.step4Desc") },
  ]

  const examplePoints = [t("example.point1"), t("example.point2"), t("example.point3")]

  const stats = [
    { value: t("stats.countriesValue"), label: t("stats.countriesLabel"), sub: t("stats.countriesSub") },
    { value: t("stats.timeValue"), label: t("stats.timeLabel"), sub: t("stats.timeSub") },
    { value: t("stats.costValue"), label: t("stats.costLabel"), sub: t("stats.costSub") },
    { value: t("stats.platformValue"), label: t("stats.platformLabel"), sub: t("stats.platformSub") },
  ]

  const individualsFeatures = (t.raw("twoSides.individualsFeatures") ?? []) as string[]
  const firmsFeatures = (t.raw("twoSides.firmsFeatures") ?? []) as string[]

  const trustIcons = [Shield, Lock, Sparkles, FileText]

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SiteHeader />

      <section className="relative overflow-hidden hero-gradient border-b border-border/40">
        <div className="absolute inset-0 hero-dot-grid opacity-60 pointer-events-none" />
        <div className="absolute -top-36 -right-24 h-[32rem] w-[32rem] rounded-full bg-primary/12 blur-3xl pointer-events-none animate-orb" />
        <div className="absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-sky-400/10 blur-3xl pointer-events-none animate-orb-delay" />
        <div className="relative mx-auto grid max-w-screen-xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 xl:px-12">
          <div className="max-w-2xl space-y-6 text-center lg:text-left">
            <div className="animate-slide-up-d0 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t("hero.badge")}</span>
            </div>

            <div className="space-y-1 animate-slide-up-d1">
              <h1 className="text-4xl font-extrabold tracking-tight leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
                {t("hero.title")}
              </h1>
              <p className="text-4xl font-extrabold tracking-tight leading-[1.05] sm:text-5xl lg:text-6xl">
                <span className="animate-shimmer-text">{t("hero.titleHighlight")}</span>
              </p>
            </div>

            <p className="animate-slide-up-d2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("hero.subtitle")}
            </p>

            <ul className="motion-stagger-list grid gap-2.5 text-left text-sm text-muted-foreground sm:grid-cols-2">
              {[t("hero.bullet1"), t("hero.bullet2"), t("hero.bullet3"), t("hero.bullet4")].map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="animate-slide-up-d4 flex flex-col items-center gap-3 pt-2 sm:flex-row lg:items-start">
              <Link href="/auth">
                <Button size="lg" className="w-full px-7 shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] sm:w-auto">
                  {t("finalCta.ctaPrimary")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full px-7 sm:w-auto">
                  {t("finalCta.ctaSecondary")}
                </Button>
              </Link>
            </div>

            <div className="animate-slide-up-d5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 lg:justify-start">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-primary" />{t("hero.trust1")}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5 text-primary" />{t("hero.trust2")}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Shield className="h-3.5 w-3.5 text-primary" />{t("hero.trust3")}</div>
            </div>
          </div>

          <div className="animate-slide-up-d3 relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" aria-hidden="true" />
            <Card className="relative overflow-hidden border-primary/15 bg-card/90 p-1 shadow-2xl shadow-primary/10 backdrop-blur">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="gap-1 text-xs"><Sparkles className="h-3 w-3" />{t("example.aiPreview")}</Badge>
                  <span className="status-pulse h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="Live" />
                </div>
                <CardTitle className="text-xl sm:text-2xl">{t("example.caseTitle")}</CardTitle>
                <CardDescription>{t("example.caseSubtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="rounded-xl border bg-background/70 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-semibold">{t("example.outcomeLabel")}</span>
                    <span className="font-bold text-primary">{t("example.outcomeValue")}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[55%] rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 animate-pulse-glow" />
                  </div>
                </div>
                {examplePoints.slice(0, 2).map((point, index) => (
                  <div key={point} className="animate-landing-task-enter flex items-start gap-3 rounded-lg border bg-background/60 px-3 py-3 text-sm" style={{ animationDelay: `${index * 100}ms` }}>
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{point}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="border-b border-border/50 bg-primary/5 dark:bg-primary/8 overflow-hidden py-2.5">
        <div className="flex whitespace-nowrap animate-marquee">
          {marqueeItems.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-5 text-xs font-semibold text-primary/80 uppercase tracking-widest shrink-0"
            >
              {item}
              <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
            </span>
          ))}
        </div>
      </div>

      <section id="how-it-works" className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full scroll-mt-20">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">{t("howItWorks.badge")}</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t("howItWorks.title")}</h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">{t("howItWorks.subtitle")}</p>
        </div>
        <div className="motion-stagger-list grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {howItWorksSteps.map((item, idx) => (
            <div key={item.step} className="relative">
              <Card className="border-2 text-center p-5 sm:p-6 h-full hover:border-primary/40 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary/30">
                  {item.step}
                </div>
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
              {idx < 3 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/25 border-y border-border/40">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-3 text-xs">{t("example.badge")}</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{t("example.title")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">{t("example.subtitle")}</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <Card className="border-2 shadow-2xl shadow-primary/8 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b pb-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    {t("example.aiPreview")}
                  </Badge>
                  <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">
                    {t("example.mediumRisk")}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{t("example.jurisdiction")}</Badge>
                </div>
                <CardTitle className="text-xl">{t("example.caseTitle")}</CardTitle>
                <CardDescription>{t("example.caseSubtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{t("example.outcomeLabel")}</span>
                    <span className="font-bold text-primary">{t("example.outcomeValue")}</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: "55%" }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("example.outcomeDisclaimer")}</p>
                </div>
                <ul className="space-y-2">
                  {examplePoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg border bg-card/60 px-3 py-2.5 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Link href="/auth">
                    <Button size="sm" className="shadow-md shadow-primary/20">{t("example.cta")}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">{t("whyNot.badge")}</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {t("whyNot.title")}{" "}
            <span className="gradient-text">{t("whyNot.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">{t("whyNot.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {whyNotItems.map((item) => (
            <Card key={item.name} className="border-2 p-6 sm:p-7 flex flex-col gap-4 hover:border-primary/40 hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t("whyNot.vsLabel", { name: item.name })}</p>
                <p className="text-sm text-muted-foreground leading-relaxed line-through decoration-muted-foreground/40">
                  {item.problem}
                </p>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground leading-relaxed">{item.solution}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">{t("platform.badge")}</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {t("platform.title")}
            <br className="hidden sm:block" />
            <span className="gradient-text">{t("platform.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">{t("platform.subtitle")}</p>
        </div>

        <div className="motion-stagger-list grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/40 border border-border/40 rounded-2xl overflow-hidden">
          {numberedFeatures.map((f, i) => (
            <div
              key={f.num}
              className="bg-background p-6 sm:p-8 group hover:bg-muted/30 transition-colors flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-muted-foreground/50 tracking-widest font-mono">[{f.num}]</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary/60 border border-primary/20 rounded px-1.5 py-0.5">{f.label}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1.5 text-foreground group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
              <Link
                href={FEATURE_HREFS[i]}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-auto"
              >
                {f.cta} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/40 bg-muted/10">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 max-w-screen-xl py-14 sm:py-20 w-full">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("stats.badge")}</p>
            <h2 className="text-2xl sm:text-3xl font-bold">{t("stats.title")}</h2>
          </div>
        <div className="motion-stagger-list grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center space-y-1">
                <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground stat-counter">{s.value}</p>
                <p className="text-sm font-semibold text-foreground/80">{s.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/25 border-y border-border/40">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-3 text-xs">{t("twoSides.badge")}</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t("twoSides.title")}</h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">{t("twoSides.subtitle")}</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
            <Card className="border-2 overflow-hidden relative group hover:border-primary/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="relative pb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl sm:text-2xl">{t("twoSides.individualsTitle")}</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  {t("twoSides.individualsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {individualsFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Link href="/auth">
                    <Button className="w-full sm:w-auto shadow-md shadow-primary/20">
                      {t("twoSides.individualsCta")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/upload-document">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Upload className="mr-2 h-4 w-4" />
                      {t("twoSides.uploadDocument")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 overflow-hidden relative group hover:border-primary/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="relative pb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl sm:text-2xl">{t("twoSides.firmsTitle")}</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  {t("twoSides.firmsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {firmsFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Link href="/for-lawyers">
                    <Button className="w-full sm:w-auto shadow-md shadow-primary/20">
                      {t("twoSides.firmsCta")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button variant="outline" className="w-full sm:w-auto">{t("twoSides.startFreeTrial")}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">{t("testimonials.badge")}</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            {t("testimonials.title")} <span className="gradient-text">{t("testimonials.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">{t("testimonials.subtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {testimonials.map((item) => (
            <Card key={item.name} className="border p-5 sm:p-6 flex flex-col gap-4 hover:border-primary/30 hover:shadow-md transition-all">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">&ldquo;{item.quote}&rdquo;</p>
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                {item.flag ? <span className="text-xl">{item.flag}</span> : null}
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-screen-xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t("trust.title")}</h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">{t("trust.subtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {trustItems.map((item, i) => {
            const Icon = trustIcons[i]
            return (
              <Card key={item.title} className="p-5 sm:p-6 text-center border hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            )
          })}
        </div>
      </section>

      <section id="faq" className="bg-muted/25 border-y border-border/40">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 sm:py-20 max-w-3xl w-full scroll-mt-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">{t("faq.title")}</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <Card key={faq.question} className="border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-sm pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t pt-3">
                    {faq.answer}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-foreground dark:bg-card">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 max-w-screen-xl py-20 sm:py-28 w-full text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-background/40 dark:text-muted-foreground">
              {t("finalCta.badge")}
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-background dark:text-foreground leading-tight tracking-tight">
              {t("finalCta.title")}
              <br />
              <span className="italic font-light">{t("finalCta.titleItalic")}</span>
            </h2>
            <p className="text-background/60 dark:text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              {t("finalCta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/auth">
                <Button
                  size="lg"
                  className="bg-background dark:bg-primary text-foreground dark:text-primary-foreground hover:bg-background/90 dark:hover:bg-primary/90 shadow-xl shadow-black/30 hover:scale-105 transition-all text-base px-8 py-6"
                >
                  {t("finalCta.ctaPrimary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/for-lawyers">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-background/70 dark:text-muted-foreground hover:text-background dark:hover:text-foreground hover:bg-background/10 dark:hover:bg-muted/50"
                >
                  {t("finalCta.ctaSecondary")}
                </Button>
              </Link>
            </div>
            <p className="text-xs text-background/40 dark:text-muted-foreground pt-2">
              {t("finalCta.footnote")}
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
