"use client"
import { useTranslations } from "next-intl"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getPortalInvoice, payPortalInvoice, type PortalInvoice } from "@/lib/api/portal"
import { ApiClientError } from "@/lib/api/client"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { getPortalSessionInfo } from "@/lib/portal/portal-session"
import { format } from "date-fns"
import { CheckCircle } from "lucide-react"

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

type StripeCardCheckoutFormProps = {
  clientSecret: string
  submitting: boolean
  onSubmitSuccess: (paymentIntentId: string, paymentStatus: string) => void
  onSubmitError: (message: string) => void
}

function StripeCardCheckoutForm({
  clientSecret,
  submitting,
  onSubmitSuccess,
  onSubmitError,
}: StripeCardCheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!stripe || !elements || !clientSecret) {
      onSubmitError("Stripe is not ready yet. Please try again.")
      return
    }

    setConfirming(true)
    onSubmitError("")
    try {
      const card = elements.getElement(CardElement)
      if (!card) {
        onSubmitError("Card details are not ready. Please try again.")
        return
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        },
      })

      if (result.error) {
        onSubmitError(result.error.message ?? "Card payment confirmation failed.")
        return
      }

      if (!result.paymentIntent) {
        onSubmitError("Payment confirmation did not return a payment intent.")
        return
      }

      onSubmitSuccess(result.paymentIntent.id, result.paymentIntent.status)
    } catch {
      onSubmitError("Card payment confirmation failed.")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "16px",
              },
            },
          }}
        />
      </div>
      <Button
        className="w-full"
        onClick={() => void handleConfirm()}
        disabled={submitting || confirming}
      >
        {confirming ? "Confirming…" : "Confirm card payment"}
      </Button>
    </div>
  )
}

function PayInvoicePageContent() {
  const t = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { currency } = useCurrency()
  const invoiceId = params.invoiceId as string
  const payToken = searchParams.get("token")?.trim() ?? ""
  const [canAccess, setCanAccess] = useState<boolean | null>(null)
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null)
  const [loadError, setLoadError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState("")
  const [payment, setPayment] = useState<{
    id: string
    amount: number
    createdAt: string
    paymentMethod: string
    invoiceNumber: string
    status: string
  } | null>(null)
  const [error, setError] = useState("")

  const useRazorpayRedirect = useMemo(
    () => (invoice?.currency ?? "").toUpperCase() === "INR",
    [invoice],
  )

  useEffect(() => {
    let cancelled = false

    async function resolveAccess() {
      if (payToken) {
        if (!cancelled) setCanAccess(true)
        return
      }

      const session = await getPortalSessionInfo()
      if (!cancelled) setCanAccess(!!session)
    }

    void resolveAccess()
    return () => {
      cancelled = true
    }
  }, [payToken])

  useEffect(() => {
    if (canAccess !== true) return

    let cancelled = false
    getPortalInvoice(invoiceId, payToken || undefined)
      .then((inv) => {
        if (!cancelled) setInvoice(inv)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiClientError ? err.message : "Invoice not found.",
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [canAccess, invoiceId, payToken])

  if (canAccess === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("pay_invoice")}</CardTitle>
            <CardDescription>This payment link is invalid or incomplete.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Open the payment link from your invoice email or client portal.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (canAccess === null || (canAccess && !invoice && !loadError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center text-muted-foreground">
            {loadError}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    )
  }

  if (invoice.status === "Paid" || invoice.status === "Cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{invoice.invoiceNumber}</CardTitle>
            <CardDescription>
              This invoice is already {invoice.status.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/portal")}>
              Back to portal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handlePay = async () => {
    setError("")
    setSubmitting(true)
    try {
      const paymentMethod = useRazorpayRedirect ? "razorpay" : "stripe"
      const result = await payPortalInvoice(
        invoiceId,
        paymentMethod,
        payToken || undefined,
      )

      if (useRazorpayRedirect) {
        if (!result.intent.checkoutUrl) {
          throw new Error("Razorpay checkout URL is missing.")
        }
        window.location.assign(result.intent.checkoutUrl)
        return
      }

      if (STRIPE_PUBLISHABLE_KEY && result.intent.clientSecret) {
        setStripeClientSecret(result.intent.clientSecret)
        return
      }

      setPayment({
        id: result.intent.providerPaymentId || result.payment.id,
        amount: result.payment.amount,
        createdAt: result.payment.createdAt,
        paymentMethod,
        invoiceNumber: result.invoice.invoiceNumber,
        status: result.intent.status ?? result.payment.status,
      })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Payment failed.")
    } finally {
      setSubmitting(false)
    }
  }

  if (payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>{t("payment_submitted")}</CardTitle>
            <CardDescription>
              We are confirming your payment with the provider and will mark the invoice paid when webhook confirmation arrives.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tBilling("invoice")}</span>
                <span className="font-medium">{payment.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tBilling("amount")}</span>
                <span className="font-medium">
                  {formatCurrencyWithSymbol(payment.amount, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tBilling("date")}</span>
                <span>{format(new Date(payment.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tAdmin("status")}</span>
                <span className="font-medium capitalize">{payment.status.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("receipt_id")}</span>
                <span className="font-mono text-xs">{payment.id}</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => router.push("/portal")}>
              Back to portal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>{t("pay_invoice")}</CardTitle>
          <CardDescription>
            {invoice.invoiceNumber} · {invoice.clientName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{invoice.matterTitle}</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrencyWithSymbol(invoice.amount, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Due {format(new Date(invoice.dueDate), "MMM d, yyyy")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {useRazorpayRedirect
              ? "India invoices use Razorpay. You will be redirected to complete checkout."
              : STRIPE_PUBLISHABLE_KEY
                ? "US/Global invoices use Stripe. Create the payment intent, then confirm the card below."
                : "Stripe publishable key is not configured. A fallback checkout flow will be used if available."}
          </p>
          {stripeClientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
              <StripeCardCheckoutForm
                clientSecret={stripeClientSecret}
                submitting={submitting}
                onSubmitError={setError}
                onSubmitSuccess={(paymentIntentId, paymentStatus) =>
                  setPayment({
                    id: paymentIntentId,
                    amount: invoice.amount,
                    createdAt: new Date().toISOString(),
                    paymentMethod: "stripe",
                    invoiceNumber: invoice.invoiceNumber,
                    status: paymentStatus,
                  })
                }
              />
            </Elements>
          ) : (
            <Button className="w-full" onClick={() => void handlePay()} disabled={submitting}>
              {submitting
                ? "Processing…"
                : useRazorpayRedirect
                  ? "Continue to Razorpay"
                  : "Create payment intent"}
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="ghost" className="w-full" onClick={() => router.push("/portal")}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PayInvoicePage() {
  const t = useTranslations("common")

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      }
    >
      <PayInvoicePageContent />
    </Suspense>
  )
}
