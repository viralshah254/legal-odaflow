"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  AlertCircle,
  Building2,
  FilePlus2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useUIStore } from "@/lib/store"
import { listClients } from "@/lib/api/clients"
import { getMissingKycDocs } from "@/lib/api/kyc"
import type { ApiClient } from "@/lib/api/types"
import { useApiData } from "@/lib/hooks/use-api-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { PageCopilotActions } from "@/components/copilot/page-copilot-actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const CORPORATE_TYPES = new Set(["COMPANY", "NGO", "PARTNERSHIP"])
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
]

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

function getAvatarColor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

function isClientProfileIncomplete(client: ApiClient): boolean {
  const isCorporate = CORPORATE_TYPES.has(client.type.toUpperCase())
  return (
    !client.email ||
    !client.phone ||
    (isCorporate && (!client.contactPeople || client.contactPeople.length === 0))
  )
}

function getClientTypeLabel(
  type: string,
  t: ReturnType<typeof useTranslations<"clients">>,
) {
  const normalized = type.toUpperCase()
  if (normalized === "COMPANY") return t("company")
  if (normalized === "INDIVIDUAL") return t("individual")
  if (normalized === "NGO") return "NGO"
  if (normalized === "PARTNERSHIP") return "Partnership"
  return type
}

export default function ClientsPage() {
  const t = useTranslations("clients")
  const { activeTenantId } = useTenant()
  const { setContext, setActiveTab } = useCopilotContext()
  const { setCopilotDrawerOpen } = useUIStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [profileFilter, setProfileFilter] = useState("ALL")
  const [serverSearch, setServerSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setServerSearch(searchQuery.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const {
    data: apiClients = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useApiData<ApiClient[]>(
    ["clients", activeTenantId, serverSearch],
    {
      apiFn: () => listClients(activeTenantId!, serverSearch || undefined),
      enabled: !!activeTenantId,
      placeholderData: (previous) => previous,
    },
  )

  const { data: missingKycAlerts = [] } = useApiData(
    ["kyc-missing", activeTenantId],
    {
      apiFn: () => getMissingKycDocs(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const clientsWithMissingKyc = useMemo(
    () => new Set(missingKycAlerts.map((alert) => alert.clientId)),
    [missingKycAlerts],
  )

  const filteredClients = useMemo(
    () =>
      apiClients.filter((client) => {
        const matchesType =
          typeFilter === "ALL" || client.type.toUpperCase() === typeFilter
        const incomplete = isClientProfileIncomplete(client)
        const matchesProfile =
          profileFilter === "ALL" ||
          (profileFilter === "INCOMPLETE" ? incomplete : !incomplete)
        return matchesType && matchesProfile
      }),
    [apiClients, profileFilter, typeFilter],
  )

  const summary = useMemo(() => {
    const organizations = apiClients.filter((client) =>
      CORPORATE_TYPES.has(client.type.toUpperCase()),
    ).length
    const incomplete = apiClients.filter(isClientProfileIncomplete).length
    const kycAttention = apiClients.filter((client) =>
      clientsWithMissingKyc.has(client.id),
    ).length
    return { organizations, incomplete, kycAttention }
  }, [apiClients, clientsWithMissingKyc])

  const openCopilotForClient = (client: ApiClient) => {
    setContext({ selectedClientId: client.id })
    setCopilotDrawerOpen(true)
    setActiveTab("ask")
  }

  const clearFilters = () => {
    setSearchQuery("")
    setTypeFilter("ALL")
    setProfileFilter("ALL")
  }

  const hasFilters =
    Boolean(searchQuery) || typeFilter !== "ALL" || profileFilter !== "ALL"

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("manageRelationships")}
        actions={
          <>
            <PageCopilotActions />
            <Button asChild data-tour="clients-create">
              <Link href="/app/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("addClient")}
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Client portfolio summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clients in view", value: apiClients.length, icon: Users },
          { label: "Organizations", value: summary.organizations, icon: Building2 },
          { label: "Profiles to complete", value: summary.incomplete, icon: AlertCircle },
          { label: "KYC needs attention", value: summary.kycAttention, icon: FilePlus2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1" data-tour="clients-search">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search clients"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear client search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-44" aria-label="Filter by client type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All client types</SelectItem>
                <SelectItem value="INDIVIDUAL">{t("individual")}</SelectItem>
                <SelectItem value="COMPANY">{t("company")}</SelectItem>
                <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                <SelectItem value="NGO">NGO</SelectItem>
              </SelectContent>
            </Select>
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="w-full lg:w-48" aria-label="Filter by profile status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All profile statuses</SelectItem>
                <SelectItem value="COMPLETE">Complete profiles</SelectItem>
                <SelectItem value="INCOMPLETE">Needs completion</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters} className="lg:shrink-0">
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
            <span>
              {isFetching && !isLoading
                ? "Updating results…"
                : `${filteredClients.length} client${filteredClients.length === 1 ? "" : "s"} shown`}
            </span>
            {serverSearch ? <span>Search runs against the client directory</span> : null}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card aria-busy="true">
          <CardContent className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading client directory…
          </CardContent>
        </Card>
      ) : error ? (
        <Card role="alert">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-destructive">{t("failedToLoad")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("checkConnection")}</p>
            </div>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? t("noSearchResults") : t("noClients")}
          description={hasFilters ? t("tryDifferentSearch") : t("addFirstClientDescription")}
          actionLabel={hasFilters ? "Clear filters" : t("addFirstClient")}
          actionHref={hasFilters ? undefined : "/app/clients/new"}
          onAction={hasFilters ? clearFilters : undefined}
          className="py-20"
        />
      ) : (
        <div data-tour="clients-list">
          <Table aria-label="Client directory">
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const incomplete = isClientProfileIncomplete(client)
                const corporate = CORPORATE_TYPES.has(client.type.toUpperCase())
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
                            getAvatarColor(client.id),
                          )}
                          aria-hidden="true"
                        >
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/app/clients/${client.id}`}
                            className="font-semibold hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {client.name}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">
                            {client.clientCode}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {corporate ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span>{getClientTypeLabel(client.type, t)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[190px] space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="max-w-[220px] truncate">{client.email || "No email"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{client.phone || "No phone"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[150px] flex-wrap gap-1.5">
                        {clientsWithMissingKyc.has(client.id) ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                            {t("kycMissingBadge")}
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            incomplete
                              ? "border-amber-500/40 text-amber-600"
                              : "border-emerald-500/40 text-emerald-600",
                          )}
                        >
                          {incomplete ? t("profileIncomplete") : "Profile complete"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/app/matters/new?clientId=${encodeURIComponent(client.id)}`}
                            aria-label={`Create matter for ${client.name}`}
                          >
                            <FilePlus2 className="mr-1.5 h-4 w-4" />
                            Matter
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openCopilotForClient(client)}
                          aria-label={`Ask Copilot about ${client.name}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/app/clients/${client.id}`}>{t("open")}</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
