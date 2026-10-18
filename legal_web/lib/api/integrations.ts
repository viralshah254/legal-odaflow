import { apiFetch } from "./client"

export interface IntegrationSyncLogEntry {
  status: string
  message: string
  records?: number
  at: string
}

export interface IntegrationConnection {
  id?: string
  tenantId: string
  provider: string
  status: string
  connectionMode?: string
  scopes?: string[] | null
  config?: Record<string, unknown> | null
  lastSyncAt?: string | null
  lastError?: string | null
  syncLogs?: IntegrationSyncLogEntry[]
  createdAt?: string
  updatedAt?: string
}

export async function listIntegrations(
  tenantId: string,
): Promise<IntegrationConnection[]> {
  return apiFetch<IntegrationConnection[]>("/integrations", { tenantId })
}

export async function connectIntegration(
  tenantId: string,
  provider: string,
): Promise<IntegrationConnection> {
  return apiFetch<IntegrationConnection>(
    `/integrations/${encodeURIComponent(provider)}/connect`,
    { method: "POST", tenantId },
  )
}

export async function disconnectIntegration(
  tenantId: string,
  provider: string,
): Promise<IntegrationConnection> {
  return apiFetch<IntegrationConnection>(
    `/integrations/${encodeURIComponent(provider)}/disconnect`,
    { method: "POST", tenantId },
  )
}

export async function retryIntegrationSync(
  tenantId: string,
  provider: string,
): Promise<{ provider: string; synced: boolean; syncLog: IntegrationSyncLogEntry & { id?: string } }> {
  return apiFetch(`/integrations/${encodeURIComponent(provider)}/sync`, {
    method: "POST",
    tenantId,
  })
}

export const INTEGRATION_PROVIDER_LABELS: Record<string, string> = {
  google_calendar: "Google Calendar",
  outlook_calendar: "Outlook Calendar",
  gmail: "Gmail",
  outlook_email: "Outlook Email",
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  docusign: "DocuSign",
  quickbooks: "QuickBooks",
}
