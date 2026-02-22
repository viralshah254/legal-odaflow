export type TimelineEventType =
  | "MATTER_CREATED"
  | "STAGE_CHANGED"
  | "CASE_TRANSFERRED"
  | "ASSISTANCE_GRANTED"
  | "ASSISTANCE_REJECTED"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "DOCUMENT_UPLOADED"
  | "KYC_VERIFIED"
  | "INVOICE_CREATED"
  | "PAYMENT_RECEIVED"

export interface TimelineEvent {
  id: string
  matterId: string
  type: TimelineEventType
  title: string
  description?: string
  userId: string
  userName: string
  createdAt: Date
  metadata?: Record<string, any>
}

export const getTimelineEventIcon = (type: TimelineEventType): string => {
  switch (type) {
    case "MATTER_CREATED":
      return "📋"
    case "STAGE_CHANGED":
      return "🔄"
    case "CASE_TRANSFERRED":
      return "↔️"
    case "ASSISTANCE_GRANTED":
      return "✅"
    case "ASSISTANCE_REJECTED":
      return "❌"
    case "TASK_CREATED":
      return "📝"
    case "TASK_COMPLETED":
      return "✓"
    case "DOCUMENT_UPLOADED":
      return "📄"
    case "KYC_VERIFIED":
      return "🔒"
    case "INVOICE_CREATED":
      return "💰"
    case "PAYMENT_RECEIVED":
      return "💵"
    default:
      return "•"
  }
}




