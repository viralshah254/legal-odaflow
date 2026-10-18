"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { deleteMyAccount } from "@/lib/api/gdpr"
import { fetchSession, logout } from "@/lib/api/auth"
import { ApiClientError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DeleteAccountForm() {
  const t = useTranslations("legal")
  const [email, setEmail] = useState("")
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSession()
      .then((user) => {
        if (cancelled) return
        setAccountEmail(user?.email ?? null)
        if (user?.email) setEmail(user.email)
      })
      .catch(() => {
        if (!cancelled) setAccountEmail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)
      setSubmitting(true)
      try {
        await deleteMyAccount(email.trim())
        setDone(true)
        await logout()
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 403) {
          setError(t("deleteAccountFormMismatch"))
        } else {
          setError(t("deleteAccountFormError"))
        }
      } finally {
        setSubmitting(false)
      }
    },
    [email, t],
  )

  if (loadingUser) {
    return <p className="text-sm text-muted-foreground">{t("deleteAccountFormLoading")}</p>
  }

  if (!accountEmail) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
        <p className="text-sm">{t("deleteAccountFormSignIn")}</p>
        <Button asChild>
          <Link href="/auth/sign-in?redirect=/deleteaccount">{t("deleteAccountFormSignInButton")}</Link>
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4">
        <p className="text-sm text-green-900 dark:text-green-100">{t("deleteAccountFormSuccess")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="font-semibold">{t("deleteAccountFormHeading")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("deleteAccountFormDescription")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-account-email">{t("deleteAccountFormEmailLabel")}</Label>
        <Input
          id="delete-account-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("deleteAccountFormEmailPlaceholder")}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="destructive" disabled={submitting}>
        {submitting ? t("deleteAccountFormSubmitting") : t("deleteAccountFormSubmit")}
      </Button>
    </form>
  )
}
