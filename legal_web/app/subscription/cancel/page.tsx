import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SubscriptionCancelPage() {
  const t = await getTranslations("marketing")

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t("subscriptionCancelTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-muted-foreground">
            <p>{t("subscriptionCancelBody")}</p>
            <Button asChild className="w-full rounded-full">
              <Link href="/pricing">{t("subscriptionBackToPricing")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <CinematicFooter />
    </div>
  )
}
