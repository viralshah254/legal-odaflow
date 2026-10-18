import { apiFetch } from "./client"

export interface CourtCase {
  id: string
  tenantId: string
  matterId: string
  caseNumber?: string | null
  cnrNumber?: string | null
  jurisdiction?: string | null
  court?: string | null
  judge?: string | null
  filingDate?: string | null
  status?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CourtHearing {
  id: string
  courtCaseId: string
  hearingDate: string
  hearingType?: string | null
  description?: string | null
  outcome?: string | null
  nextDate?: string | null
  createdAt: string
}

export interface CourtFiling {
  id: string
  courtCaseId: string
  filingDate: string
  filingType: string
  description?: string | null
  documentId?: string | null
  status?: string | null
  createdAt: string
}

export interface DocketEntry {
  id: string
  courtCaseId: string
  entryDate: string
  entryType: string
  description: string
  createdAt: string
}

export interface CreateCourtCaseRequest {
  caseNumber?: string
  cnrNumber?: string
  jurisdiction?: string
  court?: string
  judge?: string
  filingDate?: string
  status?: string
  notes?: string
}

export interface AddCourtHearingRequest {
  hearingDate: string
  hearingType?: string
  description?: string
  outcome?: string
  nextDate?: string
}

export interface AddCourtFilingRequest {
  filingDate: string
  filingType: string
  description?: string
  documentId?: string
  status?: string
}

export interface AddDocketEntryRequest {
  entryDate: string
  entryType: string
  description: string
}

export async function getMatterCourtCase(
  tenantId: string,
  matterId: string,
): Promise<CourtCase | null> {
  try {
    return await apiFetch<CourtCase>(`/matters/${matterId}/court-case`, { tenantId })
  } catch {
    return null
  }
}

export async function createMatterCourtCase(
  tenantId: string,
  matterId: string,
  data: CreateCourtCaseRequest,
): Promise<CourtCase> {
  return apiFetch<CourtCase>(`/matters/${matterId}/court-case`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listCourtHearings(
  tenantId: string,
  courtCaseId: string,
): Promise<CourtHearing[]> {
  return apiFetch<CourtHearing[]>(`/court-cases/${courtCaseId}/hearings`, { tenantId })
}

export async function addCourtHearing(
  tenantId: string,
  courtCaseId: string,
  data: AddCourtHearingRequest,
): Promise<CourtHearing> {
  return apiFetch<CourtHearing>(`/court-cases/${courtCaseId}/hearings`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listCourtFilings(
  tenantId: string,
  courtCaseId: string,
): Promise<CourtFiling[]> {
  return apiFetch<CourtFiling[]>(`/court-cases/${courtCaseId}/filings`, { tenantId })
}

export async function addCourtFiling(
  tenantId: string,
  courtCaseId: string,
  data: AddCourtFilingRequest,
): Promise<CourtFiling> {
  return apiFetch<CourtFiling>(`/court-cases/${courtCaseId}/filings`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listDocketEntries(
  tenantId: string,
  courtCaseId: string,
): Promise<DocketEntry[]> {
  return apiFetch<DocketEntry[]>(`/court-cases/${courtCaseId}/docket-entries`, { tenantId })
}

export async function addDocketEntry(
  tenantId: string,
  courtCaseId: string,
  data: AddDocketEntryRequest,
): Promise<DocketEntry> {
  return apiFetch<DocketEntry>(`/court-cases/${courtCaseId}/docket-entries`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function lookupECourts(
  tenantId: string,
  cnrNumber: string,
  options?: { matterId?: string },
): Promise<Record<string, unknown>> {
  return apiFetch(`/court/ecourts/lookup`, {
    method: "POST",
    tenantId,
    body: { cnrNumber, tenantId, matterId: options?.matterId },
  })
}

export interface UsDocketSyncResult {
  courtCaseId: string
  matterId: string
  docketNumber: string
  syncedEntries: number
  provider?: string
  entries: DocketEntry[]
}

export async function syncUsDocket(
  tenantId: string,
  data: { matterId?: string; courtCaseId?: string },
): Promise<UsDocketSyncResult> {
  return apiFetch<UsDocketSyncResult>("/court/us-docket/sync", {
    method: "POST",
    tenantId,
    body: data,
  })
}
