import { apiFetch } from "./client"

export interface Monitor {
  id: string
  tenantId: string
  name: string
  description?: string | null
  jurisdiction: string
  topics: string[]
  sources: string[]
  frequency: "DAILY" | "WEEKLY"
  isActive: boolean
  lastRunAt?: string | null
  newHitCount?: number
  totalHitCount?: number
  createdAt: string
  updatedAt: string
}

export interface MonitorHit {
  id: string
  monitorId: string
  tenantId: string
  title: string
  sourceUrl?: string | null
  sourceName?: string | null
  aiSummary?: string | null
  severity: "INFO" | "WARNING" | "CRITICAL"
  relevanceScore: number
  status: "NEW" | "READ" | "DISMISSED" | "SAVED"
  publishedAt?: string | null
  createdAt: string
}

export interface CreateMonitorPayload {
  name: string
  description?: string
  jurisdiction: string
  topics: string[]
  sources?: string[]
  frequency?: "DAILY" | "WEEKLY"
}

export async function listMonitors(tenantId: string): Promise<Monitor[]> {
  return apiFetch<Monitor[]>("/monitors", { tenantId })
}

export async function getMonitor(tenantId: string, monitorId: string): Promise<Monitor> {
  return apiFetch<Monitor>(`/monitors/${monitorId}`, { tenantId })
}

export async function createMonitor(tenantId: string, payload: CreateMonitorPayload): Promise<Monitor> {
  return apiFetch<Monitor>("/monitors", { method: "POST", body: payload, tenantId })
}

export async function updateMonitor(
  tenantId: string,
  monitorId: string,
  payload: Partial<CreateMonitorPayload & { isActive: boolean }>,
): Promise<Monitor> {
  return apiFetch<Monitor>(`/monitors/${monitorId}`, {
    method: "PATCH",
    body: payload,
    tenantId,
  })
}

export async function deleteMonitor(tenantId: string, monitorId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/monitors/${monitorId}`, { method: "DELETE", tenantId })
}

export async function listMonitorHits(
  tenantId: string,
  monitorId: string,
  status?: string,
): Promise<MonitorHit[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch<MonitorHit[]>(`/monitors/${monitorId}/hits${query}`, { tenantId })
}

export async function updateMonitorHit(
  tenantId: string,
  monitorId: string,
  hitId: string,
  status: MonitorHit["status"],
): Promise<MonitorHit> {
  return apiFetch<MonitorHit>(`/monitors/${monitorId}/hits/${hitId}`, {
    method: "PATCH",
    body: { status },
    tenantId,
  })
}

export interface MonitorHitsSummary {
  criticalCount: number
  warningCount: number
  infoCount: number
  totalUnread: number
}

export async function getMonitorsSummary(tenantId: string): Promise<MonitorHitsSummary> {
  return apiFetch<MonitorHitsSummary>("/monitors?summary=true", { tenantId })
}

export interface MonitorHitWithMonitor extends MonitorHit {
  monitor?: { name: string; jurisdiction: string }
}

export async function listAllMonitorHits(
  tenantId: string,
  status?: string,
  limit = 50,
): Promise<MonitorHitWithMonitor[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  params.set("limit", String(limit))
  return apiFetch<MonitorHitWithMonitor[]>(`/monitors/hits?${params.toString()}`, { tenantId })
}

export const MONITOR_TOPICS = [
  { id: "employment", label: "Employment Law" },
  { id: "data_privacy", label: "Data Privacy & GDPR" },
  { id: "contract_law", label: "Contract Law" },
  { id: "corporate", label: "Corporate & Securities" },
  { id: "tax", label: "Tax Law" },
  { id: "intellectual_property", label: "Intellectual Property" },
  { id: "real_estate", label: "Real Estate & Property" },
  { id: "competition", label: "Competition & Antitrust" },
  { id: "insolvency", label: "Insolvency & Restructuring" },
  { id: "environment", label: "Environmental & ESG" },
  { id: "criminal", label: "Criminal Law" },
  { id: "family", label: "Family & Succession" },
] as const

export const MONITOR_JURISDICTIONS = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "KE", label: "Kenya" },
  { code: "EU", label: "European Union" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "SG", label: "Singapore" },
] as const
