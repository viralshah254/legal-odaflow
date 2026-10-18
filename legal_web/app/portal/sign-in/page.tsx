"use client"

import { Suspense, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { portalLogin } from "@/lib/api/portal"
import { setPortalSession } from "@/lib/portal/portal-session"
import { ApiClientError } from "@/lib/api/client"

function PortalSignInForm() {
  const t = useTranslations("portal")
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("token")?.trim() ?? ""
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteToken) return

    setError("")
    setLoading(true)
    try {
      const result = await portalLogin(inviteToken)
      await setPortalSession(result.portalToken, result.client.id)
      router.push("/portal")
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("unable_to_sign_in"),
      )
    } finally {
      setLoading(false)
    }
  }

  if (!inviteToken) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">{t("client_portal_sign_in")}</CardTitle>
          <CardDescription>{t("invite_link_required_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            {t("invite_link_required_help")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">{t("client_portal_sign_in")}</CardTitle>
        <CardDescription>{t("invite_link_sign_in_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("signing_in") : t("continue_to_portal")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function PortalSignInPage() {
  const t = useTranslations("portal")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">{t("client_portal_sign_in")}</CardTitle>
              <CardDescription>{t("loading")}</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <PortalSignInForm />
      </Suspense>
    </div>
  )
}
