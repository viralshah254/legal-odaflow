"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { PaymentMethodsPanel } from "@/components/credits/PaymentMethodsPanel"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getCreditWallet } from "@/lib/api/credits"

function PaymentMethodsContent() {
  const { activeTenantId } = useTenant()

  const { data, isLoading } = useQuery({
    queryKey: ["plan-usage", activeTenantId],
    queryFn: () => getCreditWallet(activeTenantId ?? undefined),
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

  return (
    <PaymentMethodsPanel
      wallet={data.wallet}
      tenantId={activeTenantId ?? undefined}
    />
  )
}

export default function PaymentMethodsPage() {
  return (
    <div className="px-4 py-8 md:px-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/app/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
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
        <PaymentMethodsContent />
      </Suspense>
    </div>
  )
}
