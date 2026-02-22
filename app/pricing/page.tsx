"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Shield, Users } from "lucide-react"
import { usePricing } from "@/lib/contexts/pricing-context"
import { PRICING_TIERS } from "@/lib/types/pricing"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { createSubscription } from "@/lib/mock/subscription"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function PricingPage() {
  const router = useRouter()
  const {
    pricing,
    countryName,
    billingCycle,
    setBillingCycle,
    getPricePerUser,
    getAnnualPricePerUser,
    isLoading,
  } = usePricing()

  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "PROFESSIONAL" | "ENTERPRISE" | null>(null)
  const [userCount, setUserCount] = useState(1)
  const [showSignupDialog, setShowSignupDialog] = useState(false)

  const monthlyPrice = getPricePerUser()
  const professionalMonthlyPrice = monthlyPrice * 1.5 // 50% higher
  const annualPrice = getAnnualPricePerUser()
  const professionalAnnualPrice = annualPrice * 1.5 // 50% higher
  const displayPrice = billingCycle === "monthly" ? monthlyPrice : annualPrice / 12
  const professionalDisplayPrice = billingCycle === "monthly" ? professionalMonthlyPrice : professionalAnnualPrice / 12
  const savings = billingCycle === "annual" ? pricing.annualDiscount : 0

  // Calculate tier prices based on selected user count
  const starterPrice = displayPrice * userCount
  const professionalPrice = professionalDisplayPrice * userCount
  const enterprisePrice = "Custom"

  const handleStartTrial = (plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE") => {
    setSelectedPlan(plan)
    setShowSignupDialog(true)
  }

  const handleConfirmSignup = () => {
    if (!selectedPlan) return

    // Create subscription with correct pricing
    const planPrice = selectedPlan === "PROFESSIONAL" ? professionalMonthlyPrice : monthlyPrice
    createSubscription(
      selectedPlan,
      billingCycle,
      userCount,
      planPrice,
      pricing.currency,
      pricing.currencySymbol
    )

    // Redirect to sign up or dashboard
    router.push("/auth/sign-up")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Legal by OdaFlow</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/auth/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Start Free Trial</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Start with a 30-day free trial. No credit card required.
          </p>
          
          {/* Location indicator */}
          {!isLoading && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground">
                Pricing for <span className="font-medium text-foreground">{countryName}</span>
              </span>
            </div>
          )}

          {/* Billing cycle toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Monthly
            </span>
            <Switch
              checked={billingCycle === "annual"}
              onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
            />
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  billingCycle === "annual" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Annual
              </span>
              {billingCycle === "annual" && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                  Save {savings}%
                </Badge>
              )}
            </div>
          </div>

          {/* User Count Selector */}
          <div className="mb-8 p-6 rounded-lg border border-border/50 bg-muted/30 max-w-md mx-auto">
            <Label htmlFor="user-count" className="text-sm font-medium mb-3 block">
              Number of seats
            </Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setUserCount(Math.max(1, userCount - 1))}
                disabled={userCount <= 1}
              >
                -
              </Button>
              <div className="flex-1 text-center">
                <Input
                  id="user-count"
                  type="number"
                  min="1"
                  value={userCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setUserCount(Math.max(1, val))
                  }}
                  className="text-center text-2xl font-bold"
                />
                <p className="text-xs text-muted-foreground mt-1">seats</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setUserCount(userCount + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Price per user display */}
          <div className="mb-12 p-6 rounded-lg border border-border/50 bg-muted/30 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-2">Per seat, per {billingCycle === "monthly" ? "month" : "year"}</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold">
                {pricing.currencySymbol}
                {billingCycle === "monthly" ? monthlyPrice.toFixed(0) : annualPrice.toFixed(0)}
              </span>
              {billingCycle === "annual" && (
                <span className="text-lg text-muted-foreground line-through">
                  {pricing.currencySymbol}
                  {(monthlyPrice * 12).toFixed(0)}
                </span>
              )}
            </div>
            {billingCycle === "annual" && (
              <p className="text-sm text-muted-foreground mt-2">
                {pricing.currencySymbol}
                {monthlyPrice.toFixed(2)} per month when billed annually
              </p>
            )}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Total for {userCount} seat{userCount !== 1 ? "s" : ""}</p>
              <p className="text-2xl font-bold mt-1">
                {pricing.currencySymbol}
                {billingCycle === "monthly"
                  ? (monthlyPrice * userCount).toFixed(2)
                  : ((annualPrice / 12) * userCount).toFixed(2)}
                <span className="text-lg font-normal text-muted-foreground">
                  /{billingCycle === "monthly" ? "month" : "month (billed annually)"}
                </span>
              </p>
              {billingCycle === "annual" && (
                <p className="text-sm text-muted-foreground mt-1">
                  {pricing.currencySymbol}
                  {annualPrice * userCount} per year (save {savings}%)
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Starter Plan */}
          <Card>
            <CardHeader>
              <CardTitle>{PRICING_TIERS.STARTER.name}</CardTitle>
              <CardDescription>Perfect for small firms</CardDescription>
              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {pricing.currencySymbol}
                    {starterPrice.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/{billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {pricing.currencySymbol}
                  {displayPrice.toFixed(2)} per seat • {userCount} seat{userCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {PRICING_TIERS.STARTER.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => handleStartTrial("STARTER")}>
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          {/* Professional Plan */}
          <Card className={cn("border-2", PRICING_TIERS.PROFESSIONAL.popular && "border-primary")}>
            {PRICING_TIERS.PROFESSIONAL.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle>{PRICING_TIERS.PROFESSIONAL.name}</CardTitle>
              <CardDescription>For growing practices</CardDescription>
              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {pricing.currencySymbol}
                    {professionalPrice.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/{billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {pricing.currencySymbol}
                  {professionalDisplayPrice.toFixed(2)} per seat • {userCount} seat{userCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {PRICING_TIERS.PROFESSIONAL.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => handleStartTrial("PROFESSIONAL")}>
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card>
            <CardHeader>
              <CardTitle>{PRICING_TIERS.ENTERPRISE.name}</CardTitle>
              <CardDescription>For large firms</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{enterprisePrice}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {PRICING_TIERS.ENTERPRISE.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" onClick={() => handleStartTrial("ENTERPRISE")}>
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            All plans include a 30-day free trial. No credit card required.
          </p>
          <p className="text-sm text-muted-foreground">
            Need help choosing? <Link href="/auth/sign-up" className="text-primary hover:underline">Contact our sales team</Link>
          </p>
        </div>

        {/* Signup Confirmation Dialog */}
        <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Your Subscription</DialogTitle>
              <DialogDescription>
                Review your subscription details before starting your free trial
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedPlan && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Plan: {PRICING_TIERS[selectedPlan].name}</p>
                    <p className="text-sm font-medium">Seats: {userCount}</p>
                    <p className="text-sm font-medium">
                      Billing: {billingCycle === "monthly" ? "Monthly" : "Annual"} ({billingCycle === "annual" && `${savings}% savings`})
                    </p>
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Monthly Cost:</p>
                      <p className="text-2xl font-bold">
                        {pricing.currencySymbol}
                        {billingCycle === "monthly"
                          ? (monthlyPrice * userCount).toFixed(2)
                          : ((annualPrice / 12) * userCount).toFixed(2)}
                      </p>
                      {billingCycle === "annual" && (
                        <p className="text-sm text-muted-foreground">
                          {pricing.currencySymbol}
                          {annualPrice * userCount} per year
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        ✓ 30-day free trial • No credit card required
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSignupDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSignup}>
                Start Free Trial
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
