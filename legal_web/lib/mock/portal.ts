import type { DocumentRequest, DocumentRequestStatus, PortalMessage } from "@/lib/types/portal"

const STORAGE_KEY_REQUESTS = "odaflow_portal_doc_requests"
const STORAGE_KEY_MESSAGES = "odaflow_portal_messages"

const defaultDocRequests: DocumentRequest[] = [
  {
    id: "dr1",
    clientId: "c1",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    title: "Board resolution",
    description: "Signed board resolution authorizing the transaction",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "pending",
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    requestedByName: "Sarah Johnson",
  },
  {
    id: "dr2",
    clientId: "c1",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    title: "Financial statements (last 2 years)",
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "overdue",
    requestedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    requestedByName: "Sarah Johnson",
  },
  {
    id: "dr3",
    clientId: "c2",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    title: "Contract copy",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: "uploaded",
    requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    requestedByName: "David Kim",
    uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    uploadedFileName: "contract-signed.pdf",
  },
]

function loadDocRequests(): DocumentRequest[] {
  if (typeof window === "undefined") return [...defaultDocRequests]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS)
    if (!raw) return [...defaultDocRequests]
    const parsed = JSON.parse(raw) as DocumentRequest[]
    return parsed.map((r) => ({
      ...r,
      dueDate: new Date(r.dueDate),
      requestedAt: new Date(r.requestedAt),
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt) : undefined,
    }))
  } catch {
    return [...defaultDocRequests]
  }
}

function saveDocRequests(requests: DocumentRequest[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests))
}

export function getDocumentRequestsByClient(clientId: string): DocumentRequest[] {
  return loadDocRequests()
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
}

export function getDocumentRequestById(id: string): DocumentRequest | undefined {
  return loadDocRequests().find((r) => r.id === id)
}

export function uploadDocumentRequest(
  requestId: string,
  fileName: string
): DocumentRequest | null {
  const requests = loadDocRequests()
  const idx = requests.findIndex((r) => r.id === requestId)
  if (idx === -1) return null
  const now = new Date()
  requests[idx] = {
    ...requests[idx],
    status: "uploaded",
    uploadedAt: now,
    uploadedFileName: fileName,
  }
  saveDocRequests(requests)
  return requests[idx]
}

/** Stub: get messages for client (empty or a couple of mock items) */
const defaultMessages: PortalMessage[] = [
  {
    id: "msg1",
    clientId: "c1",
    subject: "Welcome to the portal",
    body: "You can view matter progress, upload requested documents, and see invoices here.",
    fromFirm: true,
    readAt: new Date(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]

function loadMessages(): PortalMessage[] {
  if (typeof window === "undefined") return [...defaultMessages]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES)
    if (!raw) return [...defaultMessages]
    const parsed = JSON.parse(raw) as PortalMessage[]
    return parsed.map((m) => ({
      ...m,
      readAt: m.readAt ? new Date(m.readAt) : undefined,
      createdAt: new Date(m.createdAt),
    }))
  } catch {
    return [...defaultMessages]
  }
}

export function getPortalMessagesByClient(clientId: string): PortalMessage[] {
  return loadMessages()
    .filter((m) => m.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
