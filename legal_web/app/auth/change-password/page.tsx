"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Shield } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordField } from "@/components/auth/password-field"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import * as authApi from "@/lib/api/auth"
import { primeAuthSession } from "@/lib/api/client"
import { validatePasswordPolicy, type PasswordPolicyResult } from "@/lib/auth/password-policy"

function passwordPolicyErrorMessage(
  t: (key: string) => string,
  result: PasswordPolicyResult,
): string {
  const code = result.errors[0]
  switch (code) {
    case "tooShort":
      return t("passwordTooShort")
    case "tooLong":
      return t("passwordTooLong")
    case "missingNumber":
      return t("passwordMissingNumber")
    default:
      return t("passwordTooShort")
  }
}

function redirectAfterPasswordChange(userType: string | undefined, router: ReturnType<typeof useRouter>) {
  if (userType === "SUPER_ADMIN") {
    router.push("/admin/dashboard")
  } else if (userType === "CONSUMER") {
    router.push("/consumer/dashboard")
  } else {
    router.push("/app/home")
  }
}

export default function ChangePasswordPage() {
  const t = useTranslations("auth")
  const tc = useTranslations("common")
  const router = useRouter()
  const { user, isLoading, isAuthenticated, setUser, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  const passwordContext = useMemo(
    () => ({
      email: user?.email,
      name: user?.name ?? undefined,
    }),
    [user?.email, user?.name],
  )

  if (!isLoading && !isAuthenticated) {
    router.replace("/auth?redirect=/auth/change-password")
    return null
  }

  if (!isLoading && isAuthenticated && !user?.mustChangePassword) {
    redirectAfterPasswordChange(user?.userType, router)
    return null
  }

  const validate = () => {
    const nextErrors: typeof fieldErrors = {}

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = t("passwordRequired")
    }

    const policy = validatePasswordPolicy(newPassword, passwordContext)
    if (!policy.valid) {
      nextErrors.newPassword = passwordPolicyErrorMessage(t, policy)
    }

    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = t("passwordsDoNotMatch")
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      })
      await primeAuthSession()
      const verified = await authApi.fetchSession()
      setUser(verified ?? response.user)
      redirectAfterPasswordChange(response.user.userType, router)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("changePasswordFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="flex justify-center mb-2">
          <Shield className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t("changePasswordTitle")}</CardTitle>
        <CardDescription>{t("changePasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <PasswordField
            id="current-password"
            label={t("currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            error={fieldErrors.currentPassword}
            showStrength={false}
            autoComplete="current-password"
          />

          <PasswordField
            id="new-password"
            label={t("newPassword")}
            value={newPassword}
            onChange={setNewPassword}
            error={fieldErrors.newPassword}
            context={passwordContext}
            autoComplete="new-password"
          />

          <PasswordField
            id="confirm-password"
            label={t("confirmNewPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
            showStrength={false}
            autoComplete="new-password"
          />

          <Button type="submit" className="w-full" disabled={submitting || isLoading}>
            {submitting ? tc("loading") : t("updatePassword")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => logout()}
          >
            {t("signOut")}
          </Button>
        </form>
      </CardContent>
    </AuthShell>
  )
}
