"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Link2, Loader2, Plug, RefreshCw, Unplug } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  connectIntegration,
  disconnectIntegration,
  INTEGRATION_PROVIDER_LABELS,
  listIntegrations,
  retryIntegrationSync,
  type IntegrationConnection,
  type IntegrationSyncLogEntry,
} from "@/lib/api/integrations"
import { ApiClientError } from "@/lib/api/client"

function providerLabel(provider: string) {
  return INTEGRATION_PROVIDER_LABELS[provider] ?? provider.replace(/_/g, " ")
}

export default function IntegrationsSettingsPage() {
  const t = useTranslations("settings")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: integrations = [], isLoading, error: loadError } = useApiData(
    ["integrations", activeTenantId],
    {
      apiFn: () => listIntegrations(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const runAction = async (
    provider: string,
    action: "connect" | "disconnect" | "sync",
  ) => {
    if (!activeTenantId) return

    setActionKey(`${action}:${provider}`)
    setError(null)

    try {
      if (action === "connect") {
        await connectIntegration(activeTenantId, provider)
      } else if (action === "disconnect") {
        await disconnectIntegration(activeTenantId, provider)
      } else {
        await retryIntegrationSync(activeTenantId, provider)
      }
      await queryClient.invalidateQueries({ queryKey: ["integrations", activeTenantId] })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Integration action failed")
    } finally {
      setActionKey(null)
    }
  }

  if (!activeTenantId) {
    return (
      <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Your firm workspace is still loading.
            </CardContent>
          </Card>
        </div>
      </RoleGate>
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t("integrations")}</h1>
            <p className="text-muted-foreground">
              Connect calendar, email, meetings, and accounting tools
            </p>
          </div>
        </div>

        {(loadError || error) && (
          <Card>
            <CardContent className="py-6 text-destructive">
              {loadError?.message ?? error}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                integration={integration}
                busy={
                  actionKey === `connect:${integration.provider}` ||
                  actionKey === `disconnect:${integration.provider}` ||
                  actionKey === `sync:${integration.provider}`
                }
                onConnect={() => runAction(integration.provider, "connect")}
                onDisconnect={() => runAction(integration.provider, "disconnect")}
                onRetrySync={() => runAction(integration.provider, "sync")}
              />
            ))}
          </div>
        )}
      </div>
    </RoleGate>
  )
}

function SyncLogList({ logs }: { logs: IntegrationSyncLogEntry[] }) {
  const t = useTranslations("settings")
  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("no_sync_attempts_recorded_yet")}</p>
    )
  }

  return (
    <div className="space-y-2 max-h-36 overflow-y-auto rounded-md border bg-muted/20 p-2">
      {logs.map((log, index) => (
        <div key={`${log.at}-${index}`} className="text-xs space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant={
                log.status === "ok" || log.status === "success"
                  ? "default"
                  : log.status === "error" || log.status === "failed"
                    ? "destructive"
                    : "secondary"
              }
              className="text-[10px]"
            >
              {log.status}
            </Badge>
            <span className="text-muted-foreground shrink-0">
              {new Date(log.at).toLocaleString()}
            </span>
          </div>
          <p className="text-muted-foreground">{log.message}</p>
        </div>
      ))}
    </div>
  )
}

function IntegrationCard({
  integration,
  busy,
  onConnect,
  onDisconnect,
  onRetrySync,
}: {
  integration: IntegrationConnection
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onRetrySync: () => void
}) {
  const t = useTranslations("settings")
  const connected = integration.status === "CONNECTED"
  const isStubMode =
    integration.connectionMode === "development_stub" ||
    integration.config?.mode === "development_stub"
  const syncLogs = integration.syncLogs ?? []

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {providerLabel(integration.provider)}
              </CardTitle>
              <CardDescription className="capitalize">
                {integration.provider.replace(/_/g, " ")}
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected && !isStubMode ? "default" : "secondary"}>
            {isStubMode ? "stub mode" : integration.status.toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isStubMode && (
          <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2">
            Development stub mode — OAuth credentials are not configured. Reconnect after env vars are set for live sync.
          </p>
        )}
        {integration.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
          </p>
        )}
        {integration.lastError && (
          <p className="text-xs text-destructive">{integration.lastError}</p>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t("sync_log")}</p>
          <SyncLogList logs={syncLogs} />
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onRetrySync}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onDisconnect}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy} onClick={onConnect}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
