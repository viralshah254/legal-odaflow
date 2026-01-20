export type AlertSeverity = "Critical" | "High" | "Normal"
export type AlertType = "DEADLINE" | "TASK" | "KYC_MISSING" | "KYC_EXPIRED" | "ASSISTANCE_REQUEST" | "TRANSFER" | "OTHER"

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
  dueAt?: Date
  createdAt: Date
  acknowledged: boolean
}

export const mockAlerts: Alert[] = [
  {
    id: "a1",
    title: "Critical deadline approaching",
    description: "Trust document filing due in 1 day",
    severity: "Critical",
    type: "DEADLINE",
    assignedToId: "3",
    assignedToName: "Emily Rodriguez",
    matterId: "m4",
    matterTitle: "Estate Planning - Johnson Family Trust",
    dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a2",
    title: "Missing KYC documents",
    description: "Client Acme Corporation has incomplete KYC",
    severity: "High",
    type: "KYC_MISSING",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    clientId: "c1",
    clientName: "Acme Corporation",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a2b",
    title: "Overdue task: File motion",
    description: "Motion for summary judgment is overdue",
    severity: "Critical",
    assignedToId: "4",
    assignedToName: "David Kim",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    taskId: "t2",
    taskTitle: "File motion for summary judgment",
    dueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a3",
    title: "Assistance request pending approval",
    description: "Emily Rodriguez requested assistance on Acme Corp matter",
    severity: "Normal",
    type: "ASSISTANCE_REQUEST",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    assistanceRequestId: "ar1",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a3b",
    title: "Missing KYC documents",
    description: "Client Acme Corp requires KYC verification",
    severity: "High",
    assignedToId: "1",
    assignedToName: "Sarah Johnson",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a4",
    title: "Invoice overdue",
    description: "Invoice INV-2024-001 is 15 days overdue",
    severity: "High",
    assignedToId: "6",
    assignedToName: "James Thompson",
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    dueAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a5",
    title: "Deposition scheduling overdue",
    description: "Task is 2 days overdue",
    severity: "Critical",
    assignedToId: "4",
    assignedToName: "David Kim",
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    taskId: "t7",
    taskTitle: "Deposition scheduling",
    dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: "a6",
    title: "Trust balance low",
    description: "Trust account balance below threshold",
    severity: "Normal",
    assignedToId: "6",
    assignedToName: "James Thompson",
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    acknowledged: false,
  },
]

export function getAlertById(id: string): Alert | undefined {
  return mockAlerts.find((a) => a.id === id)
}

export function getAlertsByAssignee(assigneeId: string): Alert[] {
  return mockAlerts.filter((a) => a.assignedToId === assigneeId)
}

export function getCriticalAlerts(): Alert[] {
  return mockAlerts.filter((a) => a.severity === "Critical" && !a.acknowledged)
}

export function getHighAlerts(): Alert[] {
  return mockAlerts.filter((a) => a.severity === "High" && !a.acknowledged)
}

export function getAllUrgentAlerts(): Alert[] {
  return mockAlerts.filter((a) => (a.severity === "Critical" || a.severity === "High") && !a.acknowledged)
}

