"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Copy, CheckCheck, Gift, Users, Star, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getMyReferralInfo, type MyReferralInfo } from "@/lib/api/referrals"
import { useAuth } from "@/lib/contexts/auth-context"

function StatCard({ label, value }: { label: string; value: number | string }) {
  const t = useTranslations("common")
  return (
    <Card>
      <CardHeader className="pb-2 pt-5">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

interface ReferralsPanelProps {
  variant?: "marketing" | "app"
}

export function ReferralsPanel({ variant = "app" }: ReferralsPanelProps) {
  const t = useTranslations("common")
  const { user, isAuthenticated, isLoading } = useAuth()
  const [info, setInfo] = useState<MyReferralInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthenticated) return
    getMyReferralInfo()
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : t("referral_load_error")))
  }, [isAuthenticated])

  async function copyLink() {
    if (!info?.shareUrl) return
    await navigator.clipboard.writeText(info.shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLawyer = user?.userType === "LAWYER"
  const wrapperClass =
    variant === "marketing"
      ? "mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl w-full"
      : "p-6 max-w-3xl w-full space-y-6"

  if (isLoading) {
    return (
      <div className={wrapperClass}>
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={variant === "marketing" ? "mx-auto px-4 py-24 max-w-lg text-center" : "p-6 text-center"}>
        <Gift className="h-12 w-12 text-primary mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">{t("refer_earn")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("referral_sign_in_prompt")}
        </p>
        <Link href="/auth">
          <Button size="lg">
            {t("referral_sign_in_cta")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <div className={variant === "app" ? "" : "text-center mb-10"}>
        {variant === "marketing" && <Gift className="h-12 w-12 text-primary mx-auto mb-4" />}
        {variant === "app" && (
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">{t("refer_earn")}</h1>
          </div>
        )}
        {variant === "marketing" && <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t("refer_earn")}</h1>}
        <p className="text-muted-foreground text-lg">
          {isLawyer ? t("referral_lawyer_intro") : t("referral_consumer_intro")}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Users className="h-6 w-6 text-primary" />,
            title: t("referral_step_share_title"),
            desc: t("referral_step_share_desc"),
          },
          {
            icon: <Star className="h-6 w-6 text-primary" />,
            title: t("referral_step_subscribe_title"),
            desc: t("referral_step_subscribe_desc"),
          },
          {
            icon: <Gift className="h-6 w-6 text-primary" />,
            title: isLawyer ? t("referral_step_earn_lawyer_title") : t("referral_step_earn_consumer_title"),
            desc: isLawyer ? t("referral_step_earn_lawyer_desc") : t("referral_step_earn_consumer_desc"),
          },
        ].map(({ icon, title, desc }) => (
          <Card key={title} className="text-center">
            <CardHeader className="pb-2">
              <div className="flex justify-center mb-2">{icon}</div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {info ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("your_invite_link")}</CardTitle>
              <CardDescription>{t("share_this_link_your_code_is_embedded_automatically")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-muted text-sm font-mono break-all">
                  {info.shareUrl}
                </code>
                <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
                  {copied ? (
                    <>
                      <CheckCheck className="h-4 w-4 mr-1.5 text-green-500" /> {t("referral_copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" /> {t("referral_copy")}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {t("your_referral_code", { code: info.code })}
              </p>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-4">{t("your_stats")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t("referral_stat_signed_up")} value={info.stats.signedUp ?? info.stats.pending} />
              <StatCard label={t("referral_stat_checkout_started")} value={info.stats.subscribed} />
              <StatCard label={t("referral_stat_rewarded")} value={info.stats.rewarded} />
              <StatCard label={t("referral_stat_credits_earned")} value={info.stats.totalCreditsEarned.toLocaleString()} />
            </div>
          </div>
        </>
      ) : (
        <Card className="animate-pulse">
          <CardContent className="py-12" />
        </Card>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>{t("the_50_discount_applies_to_the_refereeaposs_first_month_only")}</p>
        <p>{t("credits_are_awarded_after_the_refereeaposs_first_paid_subscr")}</p>
        <p>{t("referral_self_referral_ineligible")}</p>
        <p>{t("referral_attribution_is_valid_for_90_days_from_sign-up")}</p>
        {isLawyer && <p>{t("credits_are_added_to_your_primary_firm_account")}</p>}
      </div>
    </div>
  )
}
