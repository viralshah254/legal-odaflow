"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardSetupModal } from "./CardSetupModal"
import {
  type CreditWallet,
  removePaymentMethod,
} from "@/lib/api/credits"

function cardBrandLabel(brand?: string): string {
  switch (brand?.toLowerCase()) {
    case "visa":
      return "Visa"
    case "mastercard":
      return "Mastercard"
    case "amex":
      return "American Express"
    default:
      return "Card"
  }
}

interface PaymentMethodsPanelProps {
  wallet: CreditWallet
  tenantId?: string
  onUpdated?: () => void
}

export function PaymentMethodsPanel({
  wallet,
  tenantId,
  onUpdated,
}: PaymentMethodsPanelProps) {
  const queryClient = useQueryClient()
  const [cardSetupOpen, setCardSetupOpen] = useState(false)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["plan-usage"] })
    void queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
    onUpdated?.()
  }

  const removeCard = useMutation({
    mutationFn: () => removePaymentMethod(tenantId),
    onSuccess: invalidate,
  })

  const hasCard = wallet.autoTopUp?.hasPaymentMethod

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Saved payment method
          </CardTitle>
          <CardDescription>
            Your card is used for automatic credit top-ups when your balance runs low.
            Subscription billing is managed separately via Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCard ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {wallet.autoTopUp?.cardBrand && wallet.autoTopUp.cardLast4
                      ? `${cardBrandLabel(wallet.autoTopUp.cardBrand)} ···· ${wallet.autoTopUp.cardLast4}`
                      : "Card on file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Used for auto top-up when credits drop below your threshold
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCardSetupOpen(true)}>
                  Change card
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeCard.mutate()}
                  disabled={removeCard.isPending}
                >
                  {removeCard.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <Badge variant="outline" className="text-muted-foreground">
                No card saved
              </Badge>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Add a card to enable automatic credit top-ups from Plan &amp; Usage settings.
              </p>
              <Button onClick={() => setCardSetupOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add card via Stripe
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Secured by Stripe · Your card details are never stored on our servers
          </div>
        </CardContent>
      </Card>

      <CardSetupModal
        open={cardSetupOpen}
        onOpenChange={setCardSetupOpen}
        tenantId={tenantId}
        onSuccess={invalidate}
      />
    </>
  )
}
