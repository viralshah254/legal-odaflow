"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Gift, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useIsSubscribed } from "@/lib/hooks/use-is-subscribed"

export function ReferralDashboardCard() {
  const t = useTranslations("common")
  const { isSubscribed, isLoading } = useIsSubscribed()

  if (isLoading || !isSubscribed) return null
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-transparent to-transparent">
      <CardContent className="flex flex-col gap-4 py-4 pr-4 sm:pr-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{t("refer_earn_2")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Share your invite link. When a referred client subscribes, your firm earns $10 in AI
              credits and they get 50% off their first month.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="self-start shrink-0">
          <Link href="/app/referrals">
            Get your link
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
