"use client"
import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { CreditCard, Loader2, ShieldCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { setupAutoTopUp, confirmAutoTopUp } from "@/lib/api/credits"

// ─── Stripe instance (singleton, not recreated on render) ────────────────────

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// ─── Inner form (must be inside <Elements>) ──────────────────────────────────

interface CardFormProps {
  clientSecret: string
  tenantId?: string
  onSuccess: () => void
  onError: (msg: string) => void
}

function CardForm({ clientSecret, tenantId, onSuccess, onError }: CardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    try {
      const cardEl = elements.getElement(CardElement)
      if (!cardEl) {
        onError("Card element not loaded. Please refresh and try again.")
        return
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      })

      if (error) {
        onError(error.message ?? "Card setup failed. Please try again.")
        return
      }

      const pmId = typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id

      if (!pmId) {
        onError("Could not retrieve payment method. Please try again.")
        return
      }

      await confirmAutoTopUp(pmId, tenantId)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-input bg-background px-3 py-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "14px",
                color: "hsl(var(--foreground))",
                fontFamily: "inherit",
                "::placeholder": { color: "hsl(var(--muted-foreground))" },
              },
              invalid: { color: "hsl(var(--destructive))" },
            },
          }}
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Secured by Stripe · Your card details are never stored on our servers
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !stripe}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving card…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Save card
          </>
        )}
      </Button>
    </form>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

interface CardSetupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId?: string
  onSuccess: () => void
}

export function CardSetupModal({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: CardSetupModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch setup intent whenever the modal transitions to open
  useEffect(() => {
    if (!open) {
      setClientSecret(null)
      setLoadError(null)
      setFormError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setupAutoTopUp(tenantId)
      .then(async (setup) => {
        if (cancelled) return
        if (setup.clientSecret?.startsWith("seti_mock")) {
          // Dev mock — skip Stripe Elements, confirm directly
          await confirmAutoTopUp(`pm_mock_${Date.now()}`, tenantId)
          onSuccess()
          onOpenChange(false)
        } else {
          setClientSecret(setup.clientSecret)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load card setup. Please try again.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSuccess = () => {
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Add payment method
          </DialogTitle>
          <DialogDescription>
            Your card is used for auto top-ups when your balance runs low. You won&apos;t be charged until your credits drop below your set threshold.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {loadError && (
          <p className="text-sm text-destructive text-center py-4">{loadError}</p>
        )}

        {clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            {formError && (
              <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 mb-3">
                {formError}
              </p>
            )}
            <CardForm
              clientSecret={clientSecret}
              tenantId={tenantId}
              onSuccess={handleSuccess}
              onError={setFormError}
            />
          </Elements>
        )}

        {!stripePublishableKey && !loading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Stripe not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
