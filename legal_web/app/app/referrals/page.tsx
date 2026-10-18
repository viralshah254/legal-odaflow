"use client"

import { ReferralsPanel } from "@/components/referrals/referrals-panel"
import { useIsSubscribed } from "@/lib/hooks/use-is-subscribed"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Gift, Lock, ArrowRight } from "lucide-react"
import { Loader2 } from "lucide-react"

export default function AppReferralsPage() {
  const { isSubscribed, isLoading } = useIsSubscribed()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isSubscribed) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Refer &amp; Earn</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                The referral programme is available to subscribed users. Upgrade to any paid plan
                to get your unique invite link and start earning credits.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 w-full justify-center text-sm text-muted-foreground">
              <Gift className="h-4 w-4 shrink-0" />
              Earn credits for every referred client who subscribes
            </div>
            <Button asChild>
              <Link href="/app/settings/billing">
                View plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div data-tour="referrals-share">
      <ReferralsPanel variant="app" />
    </div>
  )
}
