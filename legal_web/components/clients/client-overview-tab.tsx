"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { ApiClient, ContactPerson } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type ClientOverviewData = Pick<
  ApiClient,
  | "name"
  | "type"
  | "email"
  | "phone"
  | "address"
  | "countryCode"
  | "contactPeople"
  | "createdAt"
  | "updatedAt"
>

export interface ClientInformationCardProps {
  client: ClientOverviewData
  clientTypeLabel?: string
  onEdit?: () => void
  editLabel?: string
  missingValueLabel?: string
  formatDate?: (value: string) => string
  className?: string
}

export interface ClientContactsCardProps {
  contacts?: ContactPerson[] | null
  onEdit?: () => void
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
  addLabel?: string
  editLabel?: string
  className?: string
}

export interface ClientKycAction {
  label: string
  onClick: () => void
  description?: string
  disabled?: boolean
  pending?: boolean
}

export interface ClientOverviewTabProps {
  client: ClientOverviewData
  clientTypeLabel?: string
  onEditClient?: () => void
  onEditContacts?: () => void
  kycSlot?: React.ReactNode
  kycAction?: ClientKycAction
  kycTitle?: string
  kycDescription?: string
  missingValueLabel?: string
  formatDate?: (value: string) => string
  activityItems?: ClientActivityItem[]
  nextAction?: ClientNextAction
  className?: string
}

export interface ClientActivityItem {
  id: string
  title: string
  description?: string
  occurredAt: string
}

export interface ClientNextAction {
  title: string
  description: string
  label: string
  onClick: () => void
}

function defaultFormatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function getTelephoneHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, "")
  if (cleaned.startsWith("+")) {
    return `tel:+${cleaned.slice(1).replace(/\+/g, "")}`
  }
  return `tel:${cleaned.replace(/\+/g, "")}`
}

interface InformationRowProps {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}

function InformationRow({ icon: Icon, label, children }: InformationRowProps) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden={true}
      />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
      </div>
    </div>
  )
}

export function ClientInformationCard({
  client,
  clientTypeLabel,
  onEdit,
  editLabel = "Edit details",
  missingValueLabel = "Not provided",
  formatDate = defaultFormatDate,
  className,
}: ClientInformationCardProps) {
  const missing = (
    <span className="font-normal text-muted-foreground">{missingValueLabel}</span>
  )

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Client information</CardTitle>
          <CardDescription className="mt-1">
            Core profile and contact details
          </CardDescription>
        </div>
        {onEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <InformationRow icon={Building2} label="Type">
            {clientTypeLabel ?? client.type}
          </InformationRow>
          <InformationRow icon={MapPin} label="Country">
            {client.countryCode || missing}
          </InformationRow>
          <InformationRow icon={Mail} label="Email">
            {client.email ? (
              <a
                href={`mailto:${client.email.trim()}`}
                className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {client.email}
              </a>
            ) : (
              missing
            )}
          </InformationRow>
          <InformationRow icon={Phone} label="Phone">
            {client.phone ? (
              <a
                href={getTelephoneHref(client.phone)}
                className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {client.phone}
              </a>
            ) : (
              missing
            )}
          </InformationRow>
          <InformationRow icon={MapPin} label="Address">
            {client.address || missing}
          </InformationRow>
          <InformationRow icon={CalendarDays} label="Created">
            {client.createdAt ? formatDate(client.createdAt) : missing}
          </InformationRow>
          <InformationRow icon={CalendarDays} label="Last updated">
            {client.updatedAt ? formatDate(client.updatedAt) : missing}
          </InformationRow>
        </dl>
      </CardContent>
    </Card>
  )
}

function ContactMethod({
  icon: Icon,
  value,
  href,
  missingLabel,
}: {
  icon: LucideIcon
  value?: string
  href?: string
  missingLabel: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden={true} />
      {value && href ? (
        <a
          href={href}
          className="truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value}
        </a>
      ) : (
        <span>{missingLabel}</span>
      )}
    </div>
  )
}

export function ClientContactsCard({
  contacts,
  onEdit,
  title = "Key contacts",
  description = "Directors, officers, and authorized contacts for this client",
  emptyTitle = "No contact people recorded",
  emptyDescription = "Add the person your firm should contact for instructions, approvals, and updates.",
  addLabel = "Add contact",
  editLabel = "Edit contacts",
  className,
}: ClientContactsCardProps) {
  const hasContacts = Boolean(contacts?.length)

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        {onEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            {hasContacts ? editLabel : addLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {hasContacts ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contacts!.map((person, index) => (
              <article
                key={`${person.name}-${person.email ?? person.phone ?? index}`}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {getInitials(person.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{person.name}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {person.role || "Role not provided"}
                  </p>
                  <div className="space-y-1.5">
                    <ContactMethod
                      icon={Mail}
                      value={person.email}
                      href={person.email ? `mailto:${person.email.trim()}` : undefined}
                      missingLabel="No email"
                    />
                    <ContactMethod
                      icon={Phone}
                      value={person.phone}
                      href={person.phone ? getTelephoneHref(person.phone) : undefined}
                      missingLabel="No phone"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
            <Users
              className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ClientKycActionCard({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ClientKycAction
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>
          {action?.description ?? description}
        </CardDescription>
      </CardHeader>
      {action ? (
        <CardContent>
          <Button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.pending}
            aria-busy={action.pending || undefined}
          >
            {action.pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {action.label}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function ClientOverviewTab({
  client,
  clientTypeLabel,
  onEditClient,
  onEditContacts,
  kycSlot,
  kycAction,
  kycTitle = "KYC & compliance",
  kycDescription = "Review identity and compliance requirements for this client.",
  missingValueLabel,
  formatDate,
  activityItems = [],
  nextAction,
  className,
}: ClientOverviewTabProps) {
  const t = useTranslations("clients")

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientInformationCard
          client={client}
          clientTypeLabel={clientTypeLabel}
          onEdit={onEditClient}
          missingValueLabel={missingValueLabel}
          formatDate={formatDate}
        />
        {kycSlot ?? (
          <ClientKycActionCard
            title={kycTitle}
            description={kycDescription}
            action={kycAction}
          />
        )}
      </div>
      <ClientContactsCard
        contacts={client.contactPeople}
        onEdit={onEditContacts}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle>{t("overview.recentActivity")}</CardTitle>
            </div>
            <CardDescription>{t("overview.recentActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {activityItems.length ? (
              <ol className="space-y-4">
                {activityItems.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.description ? (
                        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                      <time dateTime={item.occurredAt} className="text-xs text-muted-foreground">
                        {(formatDate ?? defaultFormatDate)(item.occurredAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("overview.noRecentActivity")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t("overview.nextAction")}</CardTitle>
            <CardDescription>{t("overview.nextActionDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {nextAction ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                <p className="font-medium">{nextAction.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{nextAction.description}</p>
                <Button type="button" className="mt-4" size="sm" onClick={nextAction.onClick}>
                  {nextAction.label}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("overview.noNextAction")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
