import { getApiBaseUrl } from "./client"
import { ApiClientError } from "./client"
import { usesCookieSession } from "@/lib/auth/session-config"
import { getPortalToken } from "@/lib/portal/portal-session"

export interface PortalClient {
  id: string
  name: string
  email: string | null
  tenantId: string
  tenantName?: string
}

export interface PortalMatter {
  id: string
  title: string
  ref: string
  status: string
  stage: string
  progressPercent?: number
  nextStep?: string
  practiceArea: string
  updatedAt: string
  matterProfile?: import("@/lib/matter-intelligence").MatterProfile
  matterTaskGraph?: import("@/lib/matter-intelligence").MatterTaskGraph
}

export interface PortalInvoice {
  id: string
  invoiceNumber: string
  clientName: string
  matterTitle: string
  amount: number
  currency: string
  status: string
  dueDate: string
  createdAt: string
  paymentLink?: string
}

export interface PortalDashboard {
  client: PortalClient
  matters: PortalMatter[]
  invoices: PortalInvoice[]
  documentRequests: Array<{
    id: string
    title: string
    matterTitle: string
    status: string
    dueDate?: string
    uploadedFileName?: string
  }>
  messages: Array<{
    id: string
    subject: string
    body: string
    fromFirm?: boolean
    readAt?: string | null
    matterId?: string | null
    createdAt: string
  }>
  sharedDocuments: Array<{
    id: string
    fileName: string
    fileUrl?: string | null
    matterId?: string | null
    updatedAt: string
  }>
}

export interface PortalLoginResponse {
  portalToken: string
  client: PortalClient
}

export interface PortalPaymentResult {
  payment: {
    id: string
    amount: number
    currency: string
    status: string
    paymentMethod: string
    createdAt: string
  }
  intent: {
    provider: string
    providerPaymentId: string
    clientSecret?: string
    checkoutUrl?: string
    status: string
  }
  invoice: PortalInvoice
}

async function portalFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers: customHeaders, ...rest } = options
  const headers = new Headers(customHeaders)
  headers.set("Content-Type", "application/json")

  if (auth) {
    if (!usesCookieSession()) {
      const token = getPortalToken()
      if (token) headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers,
    credentials: usesCookieSession() ? "include" : rest.credentials,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : response.statusText
    throw new ApiClientError(message, response.status, data)
  }
  return data as T
}

export async function portalLogin(inviteToken: string): Promise<PortalLoginResponse> {
  return portalFetch<PortalLoginResponse>("/portal/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ inviteToken }),
  })
}

export async function createPortalInvite(
  tenantId: string,
  clientId: string,
): Promise<{
  inviteToken: string
  inviteUrl: string
  expiresInDays: number
  client: PortalClient
}> {
  const { apiFetch } = await import("./client")
  return apiFetch("/portal/firm/invites", {
    method: "POST",
    tenantId,
    body: { clientId },
  })
}

export async function getPortalDashboard(): Promise<PortalDashboard> {
  return portalFetch<PortalDashboard>("/portal/dashboard")
}

export async function getPortalInvoice(
  invoiceId: string,
  payToken?: string,
): Promise<PortalInvoice> {
  const query = payToken ? `?token=${encodeURIComponent(payToken)}` : ""
  return portalFetch<PortalInvoice>(`/portal/invoices/${invoiceId}${query}`, {
    auth: !payToken,
  })
}

export async function payPortalInvoice(
  invoiceId: string,
  paymentMethod: string,
  payToken?: string,
): Promise<PortalPaymentResult> {
  const query = payToken ? `?token=${encodeURIComponent(payToken)}` : ""
  return portalFetch<PortalPaymentResult>(
    `/portal/invoices/${invoiceId}/pay${query}`,
    {
      method: "POST",
      auth: !payToken,
      body: JSON.stringify({
        paymentMethod,
        ...(payToken ? { payToken } : {}),
      }),
    },
  )
}

export async function createPortalDocumentRequest(
  tenantId: string,
  data: {
    matterId?: string
    clientId?: string
    title: string
    description?: string
    dueDate?: string
  },
): Promise<{ id: string; title: string; status: string }> {
  const { apiFetch } = await import("./client")
  return apiFetch("/portal/firm/document-requests", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function createPortalMessage(
  tenantId: string,
  data: {
    clientId: string
    matterId?: string
    subject: string
    body: string
  },
): Promise<{ id: string }> {
  const { apiFetch } = await import("./client")
  return apiFetch("/portal/firm/messages", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export interface PortalOutcomeSummary {
  outlookLabel: string
  summary: string
  overallBand: string
  disclaimers: string[]
  updatedAt: string
}

export async function getPortalOutcomeSummary(
  matterId: string,
): Promise<PortalOutcomeSummary | null> {
  try {
    return await portalFetch<PortalOutcomeSummary>(
      `/portal/matters/${matterId}/outcome-summary`,
    )
  } catch {
    return null
  }
}

export interface PortalMessage {
  id: string
  clientId: string
  matterId?: string | null
  subject: string
  body: string
  fromFirm: boolean
  readAt?: string | null
  createdAt: string
}

export async function listPortalMessages(matterId?: string): Promise<PortalMessage[]> {
  const query = matterId ? `?matterId=${encodeURIComponent(matterId)}` : ""
  return portalFetch<PortalMessage[]>(`/portal/messages${query}`)
}

export async function markPortalMessageRead(messageId: string): Promise<{ id: string; readAt?: string }> {
  return portalFetch(`/portal/messages/${messageId}/read`, { method: "PATCH" })
}

export async function replyPortalMessage(data: {
  subject: string
  body: string
  matterId?: string
}): Promise<PortalMessage> {
  return portalFetch<PortalMessage>("/portal/messages", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function uploadDocumentForRequest(
  requestId: string,
  data: {
    fileName: string
    fileUrl: string
    mimeType?: string
  },
): Promise<{
  request: {
    id: string
    status: string
    uploadedAt?: string
    uploadedFileName?: string
  }
  document: {
    id: string
    fileName: string
    fileUrl?: string | null
    createdAt: string
  }
}> {
  return portalFetch(`/portal/document-requests/${requestId}/upload`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ── Portal Tasks ──────────────────────────────────────────────────────────────

export interface PortalTask {
  id: string
  title: string
  description?: string | null
  notes?: string | null
  status: string
  priority: string
  dueDate?: string | null
  matter?: { id: string; title: string } | null
  comments: Array<{
    id: string
    body: string
    authorUserId?: string | null
    authorClientId?: string | null
    createdAt: string
  }>
}

export async function listPortalTasks(): Promise<PortalTask[]> {
  return portalFetch<PortalTask[]>("/portal/tasks")
}

export async function getPortalTask(taskId: string): Promise<PortalTask> {
  return portalFetch<PortalTask>(`/portal/tasks/${taskId}`)
}

export async function updatePortalTask(
  taskId: string,
  data: { status?: string; notes?: string },
): Promise<PortalTask> {
  return portalFetch<PortalTask>(`/portal/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function addPortalTaskComment(
  taskId: string,
  body: string,
): Promise<{ id: string; body: string; createdAt: string }> {
  return portalFetch(`/portal/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}
