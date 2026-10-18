"use client"
import { useTranslations } from "next-intl"
import { useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/contexts/auth-context"
import { runOAuthSignInFlow } from "@/lib/auth/oauth-flow"
import { SocialAuthButtons, type SocialAuthProvider } from "@/components/auth/social-auth-buttons"

interface InlineSocialSignUpProps {
  onSuccess: () => void
  title?: string
  description?: string
  compact?: boolean
  /** Override href for the "Or continue with email" link. Defaults to /auth/sign-up. */
  emailHref?: string
}

export function InlineSocialSignUp({
  onSuccess,
  title,
  description,
  compact = false,
  emailHref,
}: InlineSocialSignUpProps) {
  const t = useTranslations("issueChecker")
  const tAuth = useTranslations("auth")
  const { loginWithFirebase } = useAuth()
  const [loadingProvider, setLoadingProvider] = useState<SocialAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProvider = async (provider: SocialAuthProvider) => {
    setLoadingProvider(provider)
    setError(null)
    try {
      const result = await runOAuthSignInFlow(provider, loginWithFirebase)
      if (result.status === "authenticated") {
        onSuccess()
      }
      // redirect_pending: Firebase is handling a full-page redirect — do nothing.
      // The OAuth completion in UnifiedAuthForm will pick up the session on return.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.")
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/8 via-background to-background">
      <CardContent className={cn(compact ? "p-4 space-y-3" : "p-5 space-y-4")}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            <p className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
              {title ?? t("unlock_full_analysis")}
            </p>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground pl-6">{description}</p>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SocialAuthButtons
          onProviderClick={(provider) => void handleProvider(provider)}
          loadingProvider={loadingProvider}
          disabled={!!loadingProvider}
          showDivider
        />
        <Link
          href={emailHref ?? "/auth/sign-up"}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          {tAuth("orContinueWithEmail")}
        </Link>
      </CardContent>
    </Card>
  )
}

/** @deprecated use InlineSocialSignUp */
export const InlineGoogleSignUp = InlineSocialSignUp
