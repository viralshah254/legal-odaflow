"use client"

import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { UnifiedAuthForm } from "@/components/auth/unified-auth-form"

export default function AuthPage() {
  const tc = useTranslations("common")

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">{tc("loading")}</p>
        </div>
      }
    >
      <UnifiedAuthForm />
    </Suspense>
  )
}
