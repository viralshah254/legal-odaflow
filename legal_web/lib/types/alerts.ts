export type AlertSeverity = "Critical" | "High" | "Normal"
export type AlertType =
  | "DEADLINE"
  | "TASK"
  | "KYC_MISSING"
  | "KYC_EXPIRED"
  | "ASSISTANCE_REQUEST"
  | "TRANSFER"
  | "OTHER"

export interface Alert {
  id: string
  title: string
  description?: string
  severity: AlertSeverity
  type: AlertType
  assignedToId?: string
  assignedToName?: string
  matterId?: string
  matterTitle?: string
  taskId?: string
  taskTitle?: string
  clientId?: string
  clientName?: string
  assistanceRequestId?: string
  dueAt?: string
  createdAt: string
  acknowledged: boolean
}
