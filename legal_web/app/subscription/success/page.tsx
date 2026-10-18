import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { Loader2 } from "lucide-react"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { SubscriptionSuccessClient } from "@/components/subscription/subscription-success-client"
import { resolveAuthenticatedSession } from "@/lib/auth/auth-session.server"
import { confirmCheckoutOnServer } from "@/lib/subscriptions/confirm-checkout.server"

type PageProps = {
  searchParams: Promise<{ session_id?: string; redirect?: string }>
}

export default async function SubscriptionSuccessPage({ searchParams }: PageProps) {
  await getTranslations("marketing")
  const params = await searchParams
  const sessionId = params.session_id?.trim() ?? ""
  const redirectPath = params.redirect?.trim() ?? ""

  let serverConfirm = null
  let serverError: string | null = null

  if (sessionId.startsWith("cs_")) {
    const session = await resolveAuthenticatedSession()
    if (session) {
      try {
        serverConfirm = await confirmCheckoutOnServer({
          sessionId,
          token: session.accessToken,
          tenantId: session.user.tenantId ?? undefined,
        })
      } catch (err) {
        serverError = err instanceof Error ? err.message : "Could not confirm subscription"
      }
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          }
        >
          <SubscriptionSuccessClient
            sessionId={sessionId}
            redirectPath={redirectPath}
            serverConfirm={serverConfirm}
            serverError={serverError}
          />
        </Suspense>
      </main>
      <CinematicFooter />
    </div>
  )
}
