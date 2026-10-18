"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listAlerts } from "@/lib/api/alerts"
import { getMissingKycDocs, getExpiredKycDocs } from "@/lib/api/kyc"
import { listPendingAssistance } from "@/lib/api/assistance"
import { getMonitorsSummary } from "@/lib/api/monitors"
import type { Alert } from "@/lib/types/alerts"

/**
 * Same alert feed as the dashboard: persisted alerts + KYC gaps + pending assistance.
 */
export function useWorkspaceAlerts() {
  const { currentRole, currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const talerts = useTranslations("dashboard.alerts")
  const userId = currentUser?.id ?? ""

  const { data: allAlerts = [], isLoading: alertsLoading, error: alertsError } = useApiData<Alert[]>(
    ["alerts", activeTenantId],
    {
      apiFn: () => listAlerts(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: missingKyc = [], isLoading: missingKycLoading } = useApiData(
    ["dashboard-kyc-missing", activeTenantId],
    { apiFn: () => getMissingKycDocs(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: expiredKyc = [], isLoading: expiredKycLoading } = useApiData(
    ["dashboard-kyc-expired", activeTenantId],
    { apiFn: () => getExpiredKycDocs(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: pendingAssistance = [], isLoading: assistanceLoading } = useApiData(
    ["dashboard-assistance", activeTenantId],
    {
      apiFn: () => listPendingAssistance(activeTenantId!),
      enabled: !!activeTenantId && currentRole === "PARTNER_ADMIN",
    },
  )

  const kycAlerts: Alert[] = useMemo(
    () => [
      ...missingKyc.map((item) => ({
        id: `kyc-missing-${item.clientId}`,
        title: talerts("missingKycDocuments"),
        description: talerts("missingKycDescription", {
          clientName: item.clientName,
          count: item.docs.length,
        }),
        severity: "High" as const,
        type: "KYC_MISSING" as const,
        clientId: item.clientId,
        clientName: item.clientName,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      })),
      ...expiredKyc.map((item) => ({
        id: `kyc-expired-${item.clientId}`,
        title: talerts("expiredKycDocuments"),
        description: talerts("expiredKycDescription", {
          clientName: item.clientName,
          count: item.docs.length,
        }),
        severity: "High" as const,
        type: "KYC_EXPIRED" as const,
        clientId: item.clientId,
        clientName: item.clientName,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      })),
    ],
    [missingKyc, expiredKyc, talerts],
  )

  const assistanceAlerts: Alert[] = useMemo(
    () =>
      pendingAssistance.map((req) => ({
        id: `assist-${req.id}`,
        title: talerts("assistanceRequestPending"),
        description: talerts("assistanceRequestDescription", {
          requester: req.requestedByName ?? talerts("someone"),
          matter: req.matterTitle ?? talerts("aMatter"),
        }),
        severity: "Normal" as const,
        type: "ASSISTANCE_REQUEST" as const,
        matterId: req.matterId,
        matterTitle: req.matterTitle,
        assistanceRequestId: req.id,
        createdAt: req.createdAt,
        acknowledged: false,
      })),
    [pendingAssistance, talerts],
  )

  const unacknowledgedApiAlerts = useMemo(
    () => allAlerts.filter((a) => !a.acknowledged),
    [allAlerts],
  )

  const userApiAlerts = useMemo(
    () => unacknowledgedApiAlerts.filter((a) => a.assignedToId === userId),
    [unacknowledgedApiAlerts, userId],
  )

  const alertsToShow = useMemo(
    () =>
      currentRole === "PARTNER_ADMIN"
        ? [...unacknowledgedApiAlerts, ...kycAlerts, ...assistanceAlerts]
        : [...userApiAlerts, ...kycAlerts],
    [currentRole, unacknowledgedApiAlerts, userApiAlerts, kycAlerts, assistanceAlerts],
  )

  const criticalAlerts = useMemo(
    () => alertsToShow.filter((a) => a.severity === "Critical"),
    [alertsToShow],
  )

  const highAlerts = useMemo(
    () => alertsToShow.filter((a) => a.severity === "High"),
    [alertsToShow],
  )

  const { data: monitorSummary } = useApiData(
    ["monitors-dashboard", activeTenantId],
    {
      apiFn: () => getMonitorsSummary(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const isLoading = alertsLoading || missingKycLoading || expiredKycLoading || assistanceLoading

  return {
    alertsToShow,
    criticalAlerts,
    highAlerts,
    isLoading,
    error: alertsError,
    regulatoryHitCount: monitorSummary?.totalUnread ?? 0,
    regulatoryCriticalCount: monitorSummary?.criticalCount ?? 0,
  }
}
