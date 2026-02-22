"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard, Check, Sparkles } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { getCurrentSubscription, updateSubscriptionPlan } from "@/lib/mock/subscription"
import { usePricing } from "@/lib/contexts/pricing-context"
import { PlanTier, PLAN_FEATURE_LABELS } from "@/lib/types/plan-features"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const upgradeTo = searchParams.get("upgrade")
  const { pricing, getProfessionalPricePerUser } = usePricing()
  const subscription = getCurrentSubscription()
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null)
  const professionalPrice = getProfessionalPricePerUser()

  useEffect(() => {
    if (upgradeTo === "professional" && subscription?.plan === "STARTER") {
      setSelectedPlan("PROFESSIONAL")
      setShowUpgradeDialog(true)
    }
  }, [upgradeTo, subscription])

  if (!subscription) {
    return (
      <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/app/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Billing & Subscription</h1>
              <p className="text-muted-foreground">No active subscription</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-4">You don't have an active subscription.</p>
              <Button onClick={() => router.push("/pricing")}>
                View Pricing Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      </RoleGate>
    )
  }

  const currentPrice = subscription.pricePerUser
  const upgradeCost = (professionalPrice - currentPrice) * subscription.userCount

  const handleUpgrade = (newPlan: PlanTier) => {
    if (newPlan === "PROFESSIONAL" && subscription.plan === "STARTER") {
      updateSubscriptionPlan("PROFESSIONAL", professionalPrice)
      setShowUpgradeDialog(false)
      router.push("/app/settings/billing?upgraded=true")
    }
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Billing & Subscription</h1>
            <p className="text-muted-foreground">Manage your subscription and billing</p>
          </div>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Current Plan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{subscription.plan}</h3>
                  <Badge variant={subscription.plan === "PROFESSIONAL" ? "default" : "outline"}>
                    {subscription.plan}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {subscription.billingCycle === "monthly" ? "Monthly" : "Annual"} billing
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {subscription.currencySymbol}
                  {subscription.billingCycle === "monthly"
                    ? (subscription.pricePerUser * subscription.userCount).toFixed(2)
                    : ((subscription.pricePerUser * subscription.userCount * 12 * 0.8) / 12).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
            </div>

            {subscription.plan === "STARTER" && (
              <Button 
                className="w-full" 
                onClick={() => {
                  setSelectedPlan("PROFESSIONAL")
                  setShowUpgradeDialog(true)
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Professional
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Plan Comparison - feature-based packages */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Starter Plan</CardTitle>
              <CardDescription>Your current plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">
                  {subscription.currencySymbol}
                  {currentPrice.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">/seat/month</span>
                </p>
                <ul className="space-y-2 text-sm">
                  {PLAN_FEATURE_LABELS.STARTER.map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className={subscription.plan === "PROFESSIONAL" ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Professional Plan</CardTitle>
                {subscription.plan === "PROFESSIONAL" && (
                  <Badge className="bg-primary">Current</Badge>
                )}
              </div>
              <CardDescription>Copilot, transcripts & more</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">
                  {subscription.currencySymbol}
                  {professionalPrice.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">/seat/month</span>
                </p>
                <ul className="space-y-2 text-sm">
                  {PLAN_FEATURE_LABELS.PROFESSIONAL.map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className={label.startsWith("Everything") ? "text-muted-foreground" : ""}>
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
                {subscription.plan === "STARTER" && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => {
                      setSelectedPlan("PROFESSIONAL")
                      setShowUpgradeDialog(true)
                    }}
                  >
                    Upgrade Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade Dialog */}
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upgrade to Professional</DialogTitle>
              <DialogDescription>
                Upgrade your subscription to unlock advanced features
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Additional Monthly Cost</span>
                  <span className="text-xl font-bold text-primary">
                    +{subscription.currencySymbol}
                    {upgradeCost.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  From {subscription.currencySymbol}
                  {currentPrice.toFixed(2)} to {subscription.currencySymbol}
                  {professionalPrice.toFixed(2)} per seat
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">You'll get:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {PLAN_FEATURE_LABELS.PROFESSIONAL.filter((l) => !l.startsWith("Everything")).map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleUpgrade("PROFESSIONAL")}>
                Confirm Upgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">Loading billing…</div>}>
      <BillingPageContent />
    </Suspense>
  )
}


