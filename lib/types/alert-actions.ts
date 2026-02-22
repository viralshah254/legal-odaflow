export type AlertActionType = "COMPLETED" | "SKIPPED" | "ACKNOWLEDGED" | "NAVIGATED"

export interface AlertAction {
  id: string
  alertId: string
  actionType: AlertActionType
  userId: string
  userName: string
  timestamp: Date
  notes?: string
  navigationPath?: string
}




