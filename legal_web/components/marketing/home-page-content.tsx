"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRight, Check } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { trackLandingPageView, trackLandingCtaClick } from "@/lib/analytics/posthog"
import { resolveUtmParams } from "@/lib/analytics/utm-storage"
import { loadIssueCheckerSession } from "@/components/issue-checker/constants"
import { MobileGuestSignupSheet } from "@/components/marketing/mobile-guest-signup-sheet"
import { useMobileGuestSignupPopup } from "@/lib/hooks/use-mobile-guest-signup-popup"

const SiteHeader = dynamic(
  () => import("@/components/marketing/site-header").then((m) => m.SiteHeader),
  { loading: () => <div className="h-16" /> },
)
const LandingIssueBoard = dynamic(
  () =>
    import("@/components/marketing/landing-issue-board").then(
      (m) => m.LandingIssueBoard,
    ),
  { loading: () => <div className="min-h-[320px] animate-pulse rounded-lg bg-muted/40" /> },
)

function homeDashboardPath(userType?: string): string {
  if (userType === "SUPER_ADMIN") return "/admin/dashboard"
  if (userType === "CONSUMER") return "/consumer/dashboard"
  return "/app/home"
}

export default function HomePageContent() {
  const tCommon = useTranslations("common")
  const tHero = useTranslations("marketing.home.hero")
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const guestSignup = useMobileGuestSignupPopup()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated && user) {
      const session = loadIssueCheckerSession()
      const hasPendingIssue =
        !!session && (!!session.teaserGenerated || !!session.anonymousSessionId || !!session.data?.facts)
      if (hasPendingIssue) {
        // Landing sessions always have mode "SELF". Lawyers need ?mode=personal to prevent
        // the wizard from bouncing them to /app/intake (firm intake).
        const isLawyer = user.userType !== "CONSUMER" && user.userType !== "SUPER_ADMIN"
        if (isLawyer) {
          router.replace("/legal-issue-checker?upgrade=1&mode=personal")
        } else {
          router.replace("/legal-issue-checker?upgrade=1")
        }
        return
      }
      router.replace(homeDashboardPath(user.userType))
    }
  }, [isLoading, isAuthenticated, user, router])

  // Fire landing_page_viewed once on mount with UTM attribution + referrer
  useEffect(() => {
    const utms = resolveUtmParams()
    trackLandingPageView({
      ...utms,
      referrer: document.referrer || undefined,
      device_type: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Don't render landing content while redirecting an authenticated user
  if (isAuthenticated) return null

  const trustLines = [tHero("trust1"), tHero("trust2"), tHero("trust3")]

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SiteHeader />
      <MobileGuestSignupSheet
        open={guestSignup.open}
        onOpenChange={guestSignup.onOpenChange}
      />

      <section
        id="get-started"
        className="relative overflow-hidden hero-gradient min-h-[calc(100svh-4rem)] sm:min-h-[calc(100svh-5rem)] flex flex-col justify-center"
      >
        <div className="absolute inset-0 hero-dot-grid opacity-60 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl animate-orb" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-primary/7 rounded-full blur-3xl animate-orb-delay" />
        </div>

        <div className="relative mx-auto px-3 sm:px-6 lg:px-8 max-w-screen-xl w-full py-4 sm:py-8 flex flex-col items-center justify-center flex-1">
          {/* Hero copy — hidden on mobile during language step to avoid page scroll */}
          <div className="text-center mb-4 sm:mb-10 max-w-3xl mx-auto">
            <Badge variant="secondary" className="text-xs font-medium px-3 py-1">
              {tHero("badge")}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-4">
              {tHero("title")}{" "}
              <span className="text-primary">{tHero("titleHighlight")}</span>
            </h1>
            {/* Subtitle + trust lines — desktop/tablet only; mobile focuses on typing */}
            <p className="max-sm:hidden text-lg sm:text-xl text-muted-foreground mt-4 leading-relaxed">
              {tHero("subtitle")}
            </p>
            <div className="max-sm:hidden flex flex-wrap justify-center gap-x-6 gap-y-2 mt-5 text-sm text-muted-foreground">
              {trustLines.map((line) => (
                <span key={line} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {line}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full max-w-4xl">
            <LandingIssueBoard heroFocus />
          </div>

          <div className="mt-6 sm:mt-8 text-center">
            <Link
              href="/learn-more"
              onClick={() =>
                trackLandingCtaClick({ cta: "learn_more", location: "hero_bottom" })
              }
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                {tCommon("learnMore")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
