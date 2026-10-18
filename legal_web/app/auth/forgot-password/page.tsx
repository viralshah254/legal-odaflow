"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { isFirebaseConfigured, resetPassword, shouldUseFirebaseAuth } from "@/lib/firebase"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim()) {
      setError(t("enterEmailAddress"))
      return
    }
    if (!isFirebaseConfigured() || !shouldUseFirebaseAuth()) {
      setError(t("firebaseResetRequired"))
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToSendReset"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
        <CardHeader className="space-y-1 text-center pb-2">
          <CardTitle className="text-2xl">{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>
            {sent ? t("resetPasswordSent") : t("resetPasswordPrompt")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Link href="/auth">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToSignIn")}
              </Button>
            </Link>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("emailPlaceholderLawfirm")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("sending")}
                  </>
                ) : (
                  t("sendResetLink")
                )}
              </Button>
              <Link href="/auth">
                <Button variant="ghost" className="w-full" type="button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("backToSignIn")}
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
    </AuthShell>
  )
}
