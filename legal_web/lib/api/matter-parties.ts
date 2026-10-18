import { apiFetch } from "./client"

export interface MatterParty {
  id: string
  tenantId: string
  matterId: string
  name: string
  role: string
  organization?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMatterPartyRequest {
  name: string
  role: string
  organization?: string
  email?: string
  phone?: string
  notes?: string
}

export interface UpdateMatterPartyRequest {
  name?: string
  role?: string
  organization?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export const PARTY_ROLES = [
  { value: "CLIENT", label: "Client" },
  { value: "OPPOSING_PARTY", label: "Opposing Party" },
  { value: "WITNESS", label: "Witness" },
  { value: "EXPERT", label: "Expert / Consultant" },
  { value: "JUDGE", label: "Judge / Arbitrator" },
  { value: "OPPOSING_COUNSEL", label: "Opposing Counsel" },
  { value: "INSURER", label: "Insurer" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "THIRD_PARTY", label: "Third Party" },
  { value: "OTHER", label: "Other" },
]

export async function listMatterParties(
  tenantId: string,
  matterId: string,
): Promise<MatterParty[]> {
  return apiFetch<MatterParty[]>(`/matters/${matterId}/parties`, { tenantId })
}

export async function createMatterParty(
  tenantId: string,
  matterId: string,
  data: CreateMatterPartyRequest,
): Promise<MatterParty> {
  return apiFetch<MatterParty>(`/matters/${matterId}/parties`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMatterParty(
  tenantId: string,
  matterId: string,
  partyId: string,
  data: UpdateMatterPartyRequest,
): Promise<MatterParty> {
  return apiFetch<MatterParty>(`/matters/${matterId}/parties/${partyId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteMatterParty(
  tenantId: string,
  matterId: string,
  partyId: string,
): Promise<void> {
  await apiFetch(`/matters/${matterId}/parties/${partyId}`, {
    method: "DELETE",
    tenantId,
  })
}
