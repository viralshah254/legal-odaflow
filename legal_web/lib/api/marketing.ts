import { apiFetch } from "./client"

export interface CreateDemoRequestPayload {
  contactName: string
  email: string
  companyName: string
  phone?: string
  jobTitle?: string
  firmSize?: string
  countryCode?: string
  message?: string
  source?: string
}

export interface DemoRequestRecord {
  id: string
  contactName: string
  email: string
  companyName: string
  phone: string | null
  jobTitle: string | null
  firmSize: string | null
  countryCode: string
  message: string | null
  source: string
  status: string
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export async function submitDemoRequest(
  data: CreateDemoRequestPayload,
): Promise<DemoRequestRecord> {
  return apiFetch<DemoRequestRecord>("/marketing/demo-requests", {
    method: "POST",
    body: data,
    auth: false,
  })
}
