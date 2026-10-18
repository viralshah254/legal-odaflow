import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Reveal } from "@/components/motion/reveal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"
import { Key, Webhook, Code2, Shield, ArrowRight } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Developers",
    description:
      "Umbrella public API documentation — API keys, webhooks, and integration guides.",
    path: "/developers",
  }, SITE_NAME)
}

const WEBHOOK_EVENTS = [
  "matter.created",
  "matter.updated",
  "invoice.created",
  "invoice.paid",
  "time_entry.submitted",
  "trust.entry.approved",
  "document.uploaded",
]

const API_SCOPES = [
  "read:matters",
  "write:matters",
  "read:clients",
  "read:invoices",
  "read:documents",
]

export default async function DevelopersPage() {
  const t = await getTranslations("marketing")
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "https://api.odaflow.com"

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-12">
        <Reveal mode="mount" className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Code2 className="h-3 w-3" />
            {t("developersBadge")}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 sm:text-5xl">{t("developersTitle")}</h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            {t("developersIntro")}{" "}
            <Link href="/app/settings" className="text-blue-700 underline">
              Settings
            </Link>.
          </p>
        </Reveal>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-slate-950">
            <Key className="h-5 w-5 text-blue-600" />
            {t("developersApiKeys")}
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("developersAuthTitle")}</CardTitle>
              <CardDescription>{t("developersAuthDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto">
                <pre>{`POST ${apiBase}/api/v1/public-api/keys
Authorization: Bearer <session_token>
X-Tenant-Id: <tenant_id>
Content-Type: application/json

{
  "name": "CRM sync",
  "scopes": ["read:matters", "read:clients"]
}`}</pre>
              </div>
              <p className="text-muted-foreground">
                {t("developersListKeys")}{" "}
                <code className="text-xs bg-muted px-1 rounded">GET /public-api/keys</code>
              </p>
              <div className="flex flex-wrap gap-2">
                {API_SCOPES.map((scope) => (
                  <Badge key={scope} variant="outline" className="font-mono text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-slate-950">
            <Webhook className="h-5 w-5 text-blue-600" />
            {t("developersWebhooks")}
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("developersSubscriptionsTitle")}</CardTitle>
              <CardDescription>{t("developersSubscriptionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto">
                <pre>{`POST ${apiBase}/api/v1/webhooks/subscriptions
Authorization: Bearer <session_token>
X-Tenant-Id: <tenant_id>

{
  "url": "https://your-app.com/webhooks/legal",
  "secret": "whsec_...",
  "events": ["matter.created", "invoice.paid"]
}`}</pre>
              </div>
              <p className="text-muted-foreground">{t("developersVerifyDeliveries")}</p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <li key={event} className="flex items-center gap-2 text-muted-foreground">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <code className="text-xs">{event}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-slate-950">
            <Shield className="h-5 w-5 text-blue-600" />
            {t("developersSecurity")}
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
              <p>{t("developersSecurityRotate")}</p>
              <p>{t("developersSecurityWebhook")}</p>
              <p>{t("developersSecurityTls")}</p>
            </CardContent>
          </Card>
        </section>
      </main>

      <CinematicFooter />
    </div>
  )
}
