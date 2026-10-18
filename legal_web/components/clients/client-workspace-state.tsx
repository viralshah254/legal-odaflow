import * as React from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ClientWorkspaceLoadingProps {
  label: string
  compact?: boolean
  className?: string
}

export function ClientWorkspaceLoading({
  label,
  compact = false,
  className,
}: ClientWorkspaceLoadingProps) {
  return (
    <div
      className={cn("space-y-3", compact ? "py-6" : "p-4 sm:p-6", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <Skeleton className={cn("h-8", compact ? "w-40" : "w-2/5")} />
      <Skeleton className="h-4 w-3/5" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className={cn(compact ? "h-20" : "h-28")} />
        <Skeleton className={cn(compact ? "h-20" : "h-28")} />
      </div>
    </div>
  )
}

interface ClientWorkspaceErrorProps {
  title: string
  description?: string
  retryLabel: string
  onRetry: () => void
  compact?: boolean
}

export function ClientWorkspaceError({
  title,
  description,
  retryLabel,
  onRetry,
  compact = false,
}: ClientWorkspaceErrorProps) {
  return (
    <Card role="alert">
      <CardContent className={cn("text-center", compact ? "py-8" : "py-12")}>
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="font-medium text-destructive">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>
        ) : null}
        <Button
          type="button"
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={onRetry}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

interface ClientWorkspaceEmptyProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function ClientWorkspaceEmpty({
  icon: Icon,
  title,
  description,
  action,
}: ClientWorkspaceEmptyProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center sm:py-14">
        <Icon className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" aria-hidden={true} />
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  )
}
