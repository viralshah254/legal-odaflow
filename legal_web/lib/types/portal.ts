/** Document request from firm to client (visible in portal) */
export type DocumentRequestStatus = "pending" | "uploaded" | "overdue"

export interface DocumentRequest {
  id: string
  clientId: string
  matterId: string
  matterTitle: string
  title: string
  description?: string
  dueDate: Date
  status: DocumentRequestStatus
  requestedAt: Date
  requestedByName?: string
  uploadedAt?: Date
  uploadedFileName?: string
}

/** Portal message (stub) */
export interface PortalMessage {
  id: string
  clientId: string
  subject: string
  body: string
  fromFirm: boolean
  readAt?: Date
  createdAt: Date
}
