import { apiFetch } from "./client"

export interface ClioMigrationJob {
  jobId: string
  agentJobId: string
  status: string
  provider: "clio"
  tenantId: string
  fileName: string
  rowCount: number
  parsedRowCount: number
  entityTypes: string[]
  validationErrors: string[]
  message: string
  queuedAt: string
  updatedAt: string
  completedAt?: string
  result?: Record<string, unknown>
}

export async function importClioCsv(
  tenantId: string,
  payload: {
    fileName: string
    csvContent: string
    rowCount: number
    entityTypes?: string[]
  },
): Promise<ClioMigrationJob> {
  return apiFetch<ClioMigrationJob>("/migration/clio/import", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function getClioMigrationJob(
  tenantId: string,
  jobId: string,
): Promise<ClioMigrationJob> {
  return apiFetch<ClioMigrationJob>(`/migration/clio/jobs/${jobId}`, { tenantId })
}
