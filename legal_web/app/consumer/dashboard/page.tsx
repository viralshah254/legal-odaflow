"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  CreditCard,
  FileSearch,
  FolderOpen,
  PenLine,
  Plus,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listCases } from "@/lib/api/consumers"
import { CreditBalanceWidget } from "@/components/consumer/credit-balance-widget"
import { ActionTiltCard, type ActionCard } from "@/components/shared/action-tilt-card"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { countryFlag, sectionFinderCountryParam } from "@/lib/geo/country-flag"
import { formatDate } from "@/lib/utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function ConsumerDashboardPage() {
  const t = useTranslations("dashboard")
  const tConsumer = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const { user, isAuthenticated } = useAuth()
  const { countryCode, isLoading: countryLoading } = useDetectedCountry()
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["consumer-cases"],
    queryFn: listCases,
    enabled: isAuthenticated,
  })

  const firstName = user?.name?.trim().split(" ")[0] ?? null
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? tConsumer("goodMorning") : hour < 17 ? tConsumer("goodAfternoon") : tConsumer("goodEvening")

  const sectionBadge = countryLoading ? undefined : countryFlag(countryCode)

  const actions = useMemo<ActionCard[]>(() => {
    const finderCountry = sectionFinderCountryParam(countryCode)
    const sectionHref = finderCountry
      ? `/consumer/section-finder?country=${finderCountry}`
      : "/consumer/section-finder"
    return [
      {
        label: tConsumer("nav.issueChecker"),
        description: tConsumer("homeIssueCheckerDesc"),
        href: "/legal-issue-checker",
        icon: CheckSquare,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/15",
        ringColor: "bg-emerald-400/20",
        glowColor: "rgba(16,185,129,0.28)",
        cardGradient: "from-emerald-500/[0.07] to-emerald-600/[0.02]",
        borderColor: "border-emerald-500/20 hover:border-emerald-400/50",
      },
      {
        label: tConsumer("nav.research"),
        description: tConsumer("homeResearchDesc"),
        href: "/consumer/research",
        icon: Search,
        iconColor: "text-blue-400",
        iconBg: "bg-blue-500/15",
        ringColor: "bg-blue-400/20",
        glowColor: "rgba(59,130,246,0.28)",
        cardGradient: "from-blue-500/[0.07] to-blue-600/[0.02]",
        borderColor: "border-blue-500/20 hover:border-blue-400/50",
      },
      {
        label: tConsumer("nav.documentReview"),
        description: tConsumer("homeDocumentReviewDesc"),
        href: "/consumer/document-review",
        icon: FileSearch,
        iconColor: "text-violet-400",
        iconBg: "bg-violet-500/15",
        ringColor: "bg-violet-400/20",
        glowColor: "rgba(139,92,246,0.28)",
        cardGradient: "from-violet-500/[0.07] to-violet-600/[0.02]",
        borderColor: "border-violet-500/20 hover:border-violet-400/50",
      },
      {
        label: tConsumer("nav.docuDraft"),
        description: tConsumer("homeDocuDraftDesc"),
        href: "/consumer/document-drafting",
        icon: PenLine,
        badge: sectionBadge,
        iconColor: "text-violet-400",
        iconBg: "bg-violet-500/15",
        ringColor: "bg-violet-400/20",
        glowColor: "rgba(139,92,246,0.28)",
        cardGradient: "from-violet-500/[0.07] to-violet-600/[0.02]",
        borderColor: "border-violet-500/20 hover:border-violet-400/50",
      },
      {
        label: tConsumer("nav.sectionFinder"),
        description: tConsumer("homeSectionFinderDesc"),
        href: sectionHref,
        icon: BookOpen,
        badge: sectionBadge,
        iconColor: "text-orange-400",
        iconBg: "bg-orange-500/15",
        ringColor: "bg-orange-400/20",
        glowColor: "rgba(249,115,22,0.28)",
        cardGradient: "from-orange-500/[0.07] to-orange-600/[0.02]",
        borderColor: "border-orange-500/20 hover:border-orange-400/50",
      },
      {
        label: tConsumer("nav.findLawyer"),
        description: tConsumer("homeFindLawyerDesc"),
        href: "/consumer/find-lawyer",
        icon: Scale,
        iconColor: "text-teal-400",
        iconBg: "bg-teal-500/15",
        ringColor: "bg-teal-400/20",
        glowColor: "rgba(20,184,166,0.28)",
        cardGradient: "from-teal-500/[0.07] to-teal-600/[0.02]",
        borderColor: "border-teal-500/20 hover:border-teal-400/50",
      },
      {
        label: tConsumer("nav.cases"),
        description: tConsumer("homeCasesDesc"),
        href: "/consumer/cases",
        icon: FolderOpen,
        iconColor: "text-sky-400",
        iconBg: "bg-sky-500/15",
        ringColor: "bg-sky-400/20",
        glowColor: "rgba(14,165,233,0.28)",
        cardGradient: "from-sky-500/[0.07] to-sky-600/[0.02]",
        borderColor: "border-sky-500/20 hover:border-sky-400/50",
      },
      {
        label: tConsumer("nav.lawyerReview"),
        description: tConsumer("homeLawyerReviewDesc"),
        href: "/consumer/lawyer-review",
        icon: ShieldCheck,
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/15",
        ringColor: "bg-amber-400/20",
        glowColor: "rgba(245,158,11,0.28)",
        cardGradient: "from-amber-500/[0.07] to-amber-600/[0.02]",
        borderColor: "border-amber-500/20 hover:border-amber-400/50",
      },
      {
        label: tConsumer("nav.subscription"),
        description: tConsumer("homeSubscriptionDesc"),
        href: "/consumer/subscription",
        icon: CreditCard,
        iconColor: "text-indigo-400",
        iconBg: "bg-indigo-500/15",
        ringColor: "bg-indigo-400/20",
        glowColor: "rgba(99,102,241,0.28)",
        cardGradient: "from-indigo-500/[0.07] to-indigo-600/[0.02]",
        borderColor: "border-indigo-500/20 hover:border-indigo-400/50",
      },
    ]
  }, [countryCode, countryLoading, sectionBadge, tConsumer])

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-orb absolute -top-48 -left-48 h-[650px] w-[650px] rounded-full bg-primary/[0.045] blur-3xl" />
        <div className="animate-orb-delay absolute top-1/3 -right-48 h-[550px] w-[550px] rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="animate-orb absolute -bottom-24 left-1/3 h-[450px] w-[450px] rounded-full bg-emerald-500/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-slide-up-d0">
          <div>
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 px-3 py-1 backdrop-blur-sm">
              <Zap className="h-3 w-3 text-primary/70" />
              <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground/70 uppercase">
                {format(new Date(), "EEEE, MMMM d")}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p className="mt-3 text-[15px] text-muted-foreground/80">{tConsumer("homeSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/legal-issue-checker">
              <Button size="sm" className="gap-1.5 shadow-sm shadow-primary/20">
                <Plus className="h-4 w-4" />
                {tConsumer("newIssueCheck")}
              </Button>
            </Link>
            <Link href="/consumer/settings">
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label={tConsumer("generalSettings")}>
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up-d1" data-tour="consumer-cases">
          <CreditBalanceWidget />
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-medium">{t("active_cases")}</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">{isLoading ? "—" : cases.length}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">
                {cases.length === 0 ? tConsumer("no_cases_yet") : `${cases.filter((c) => c.status === "ACTIVE").length} ${tConsumer("active").toLowerCase()}`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-medium">{tConsumer("nav.reports")}</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {isLoading ? "—" : cases.filter((c) => c.reports?.length).length}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">{tConsumer("your_legal_reports")}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-medium">{tConsumer("jurisdiction")}</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">{user?.countryCode ?? countryCode ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">{tConsumer("nav.findLawyer")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="animate-slide-up-d2" data-tour="consumer-actions">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {actions.map((action, i) => (
              <ActionTiltCard key={action.href} action={action} index={i} />
            ))}
          </div>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur-sm animate-slide-up-d3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t("recent_cases")}</CardTitle>
                <CardDescription className="text-sm">{t("your_latest_legal_issue_checks")}</CardDescription>
              </div>
              {cases.length > 0 ? (
                <Link href="/consumer/cases">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                    {tCommon("viewAll")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <PageSkeleton rows={3} />
            ) : cases.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">{tConsumer("no_cases_yet")}</p>
                <p className="text-muted-foreground text-xs mt-1 mb-4">{tConsumer("no_cases_yet_start_with_the_legal_issue_checker")}</p>
                <Link href="/legal-issue-checker">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    {tConsumer("check_my_legal_issue")}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {cases.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={`/consumer/cases/${c.id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.issueType} · {formatDate(c.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">{c.status.toLowerCase()}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
