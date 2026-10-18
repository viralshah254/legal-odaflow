import { AlertAction, AlertActionType } from "@/lib/types/alert-actions"

export const mockAlertActions: AlertAction[] = []

export function logAlertAction(
  alertId: string,
  actionType: AlertActionType,
  userId: string,
  userName: string,
  notes?: string,
  navigationPath?: string
): AlertAction {
  const action: AlertAction = {
    id: `aa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    alertId,
    actionType,
    userId,
    userName,
    timestamp: new Date(),
    notes,
    navigationPath,
  }
  mockAlertActions.push(action)
  return action
}

export function getAlertActionsByAlert(alertId: string): AlertAction[] {
  return mockAlertActions
    .filter((a) => a.alertId === alertId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function getAlertActionsByUser(userId: string): AlertAction[] {
  return mockAlertActions
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

export function getAllAlertActions(): AlertAction[] {
  return [...mockAlertActions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}




