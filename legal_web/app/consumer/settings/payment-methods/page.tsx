"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaymentMethodsPanel } from "@/components/credits/PaymentMethodsPanel"
import { getCreditWallet } from "@/lib/api/credits"

function ConsumerPaymentMethodsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["plan-usage", "consumer"],
    queryFn: () => getCreditWallet(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Unable to load payment methods.
      </div>
    )
  }

  return <PaymentMethodsPanel wallet={data.wallet} />
}

export default function ConsumerPaymentMethodsPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4" data-tour="consumer-payment-methods">
        <Link href="/consumer/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Payment methods</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the card used for automatic credit top-ups
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ConsumerPaymentMethodsContent />
      </Suspense>
    </div>
  )
}
