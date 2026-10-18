"use client"

import { useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  icon?: LucideIcon
  className?: string
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  icon: Icon = AlertCircle,
  className,
}: ErrorStateProps) {
  const tErrors = useTranslations("errors")
  const tCommon = useTranslations("common")
  const displayTitle = title ?? tErrors("generic")
  const displayRetryLabel = retryLabel ?? tCommon("try_again")

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <Icon className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-destructive">{displayTitle}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {displayRetryLabel}
        </Button>
      )}
    </div>
  )
}
