import { apiFetch, ApiClientError } from "./client"

export interface CourtHearing {
  id: string
  courtCaseId: string
  scheduledAt: string
  hearingType: string | null
  location: string | null
  notes: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface CourtFiling {
  id: string
  courtCaseId: string
  filedAt: string | null
  filingType: string
  title: string
  documentId: string | null
  status: string
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface DocketEntry {
  id: string
  courtCaseId: string
  entryDate: string
  description: string
  source: string | null
  externalId: string | null
  createdAt: string
}

export interface CourtCase {
  id: string
  tenantId: string
  matterId: string
  countryCode: string
  courtName: string | null
  caseNumber: string | null
  cnrNumber: string | null
  externalId: string | null
  status: string
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  hearings?: CourtHearing[]
  filings?: CourtFiling[]
  docketEntries?: DocketEntry[]
}

export interface CreateCourtCaseInput {
  countryCode: string
  courtName?: string
  caseNumber?: string
  cnrNumber?: string
  externalId?: string
  status?: string
  metadata?: Record<string, unknown>
}

export interface CreateCourtHearingInput {
  scheduledAt: string
  hearingType?: string
  location?: string
  notes?: string
  status?: string
}

export interface CreateCourtFilingInput {
  filingType: string
  title: string
  filedAt?: string
  documentId?: string
  status?: string
  metadata?: Record<string, unknown>
}

export interface EcourtsLookupResult {
  provider: string
  cnrNumber: string
  status: string
  caseTitle: string
  courtName: string
  caseType: string
  filingDate: string
  nextHearingDate: string
  caseStatus: string
  parties: { petitioner: string; respondent: string }
  hearings: Array<{ date: string; purpose: string; judge: string }>
  disclaimer: string
}

export interface UsDocketSyncResult {
  courtCaseId: string
  matterId: string
  docketNumber: string
  syncedEntries: number
  entries: DocketEntry[]
}

export async function getCourtCase(
  tenantId: string,
  matterId: string,
): Promise<CourtCase | null> {
  try {
    return await apiFetch<CourtCase>(`/matters/${matterId}/court-case`, { tenantId })
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null
    }
    throw error
  }
}

export async function createCourtCase(
  tenantId: string,
  matterId: string,
  data: CreateCourtCaseInput,
): Promise<CourtCase> {
  return apiFetch<CourtCase>(`/matters/${matterId}/court-case`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listHearings(
  tenantId: string,
  courtCaseId: string,
): Promise<CourtHearing[]> {
  return apiFetch<CourtHearing[]>(`/court-cases/${courtCaseId}/hearings`, { tenantId })
}

export async function createHearing(
  tenantId: string,
  courtCaseId: string,
  data: CreateCourtHearingInput,
): Promise<CourtHearing> {
  return apiFetch<CourtHearing>(`/court-cases/${courtCaseId}/hearings`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function listFilings(
  tenantId: string,
  courtCaseId: string,
): Promise<CourtFiling[]> {
  return apiFetch<CourtFiling[]>(`/court-cases/${courtCaseId}/filings`, { tenantId })
}

export async function createFiling(
  tenantId: string,
  courtCaseId: string,
  data: CreateCourtFilingInput,
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
  return apiFetch<DocketEntry[]>(`/court-cases/${courtCaseId}/docket-entries`, {
    tenantId,
  })
}

export async function ecourtsLookup(cnrNumber: string): Promise<EcourtsLookupResult> {
  return apiFetch<EcourtsLookupResult>("/court/ecourts/lookup", {
    method: "POST",
    body: { cnrNumber },
  })
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
