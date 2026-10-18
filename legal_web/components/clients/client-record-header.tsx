import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronRight,
  FilePlus2,
  MoreHorizontal,
} from "lucide-react"

import type { ApiClient } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type ClientRecordStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"

export interface ClientRecordStatus {
  label: string
  tone?: ClientRecordStatusTone
}

export interface ClientRecordBreadcrumb {
  label: string
  href?: string
}

export interface ClientRecordHeaderProps {
  client: Pick<ApiClient, "id" | "name" | "type" | "clientCode" | "countryCode">
  clientTypeLabel?: string
  profileStatus?: ClientRecordStatus
  kycStatus?: ClientRecordStatus
  breadcrumbs?: ClientRecordBreadcrumb[]
  backHref?: string
  backLabel?: string
  onBack?: () => void
  createMatterHref?: string
  createMatterLabel?: string
  onCreateMatter?: () => void
  secondaryActions?: React.ReactNode
  mobileSecondaryActions?: React.ReactNode
  onMobileSecondaryActions?: () => void
  mobileActionsLabel?: string
  className?: string
}

const statusClasses: Record<ClientRecordStatusTone, string> = {
  neutral: "border-border/60 text-muted-foreground",
  success: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  danger: "border-red-500/40 text-red-700 dark:text-red-400",
  info: "border-primary/40 text-primary",
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function StatusBadge({ status }: { status: ClientRecordStatus }) {
  return (
    <Badge
      variant="outline"
      className={statusClasses[status.tone ?? "neutral"]}
    >
      {status.label}
    </Badge>
  )
}

export function ClientRecordHeader({
  client,
  clientTypeLabel,
  profileStatus,
  kycStatus,
  breadcrumbs,
  backHref = "/app/clients",
  backLabel = "Back to clients",
  onBack,
  createMatterHref,
  createMatterLabel = "Create matter",
  onCreateMatter,
  secondaryActions,
  mobileSecondaryActions,
  onMobileSecondaryActions,
  mobileActionsLabel = "More actions",
  className,
}: ClientRecordHeaderProps) {
  const resolvedCreateMatterHref =
    createMatterHref ??
    `/app/matters/new?clientId=${encodeURIComponent(client.id)}`
  const resolvedBreadcrumbs = breadcrumbs ?? [
    { label: "Clients", href: "/app/clients" },
    { label: client.name },
  ]

  return (
    <header className={cn("space-y-4", className)} data-tour="client-header">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground">
          {resolvedBreadcrumbs.map((item, index) => {
            const current = index === resolvedBreadcrumbs.length - 1
            return (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 ? (
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </li>
                ) : null}
                <li className={cn("min-w-0", current && "truncate")}>
                  {item.href && !current ? (
                    <Link
                      href={item.href}
                      className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(current && "font-medium text-foreground")}
                      aria-current={current ? "page" : undefined}
                      title={current ? item.label : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              </React.Fragment>
            )
          })}
        </ol>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label={backLabel}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href={backHref} aria-label={backLabel}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}

          <div
            className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary sm:flex"
            aria-hidden="true"
          >
            {getInitials(client.name)}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {client.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {clientTypeLabel ?? client.type}
              </span>
              {client.clientCode ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {client.clientCode}
                </Badge>
              ) : null}
              {client.countryCode ? (
                <Badge variant="secondary" className="uppercase">
                  {client.countryCode}
                </Badge>
              ) : null}
              {profileStatus ? <StatusBadge status={profileStatus} /> : null}
              {kycStatus ? <StatusBadge status={kycStatus} /> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:pl-[5.5rem] md:pl-0">
          {secondaryActions ? (
            <div className="hidden items-center gap-2 md:flex">{secondaryActions}</div>
          ) : null}

          {mobileSecondaryActions ? (
            <div className="md:hidden">{mobileSecondaryActions}</div>
          ) : null}
          {onMobileSecondaryActions ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMobileSecondaryActions}
              className="md:hidden"
              aria-label={mobileActionsLabel}
            >
              <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              Actions
            </Button>
          ) : null}

          {onCreateMatter ? (
            <Button type="button" size="sm" onClick={onCreateMatter}>
              <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {createMatterLabel}
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href={resolvedCreateMatterHref}>
                <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {createMatterLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
