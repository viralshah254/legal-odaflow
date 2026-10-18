import { Notification } from "@/lib/types"

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "TASK_OVERDUE",
    title: "Overdue Task",
    message: "File motion for summary judgment is overdue",
    userId: "4",
    read: false,
    link: "/app/tasks?task=t2",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "notif-2",
    type: "TASK_DUE",
    title: "Task Due Today",
    message: "Complete trust documents is due today",
    userId: "3",
    read: false,
    link: "/app/tasks?task=t4",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "notif-3",
    type: "KYC_EXPIRED",
    title: "KYC Expired",
    message: "Client Acme Corporation KYC documents have expired",
    userId: "1",
    read: false,
    link: "/app/clients/c1?tab=kyc",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "notif-4",
    type: "INVOICE_OVERDUE",
    title: "Invoice Overdue",
    message: "Invoice INV-2024-001 is 15 days overdue",
    userId: "6",
    read: true,
    link: "/app/finance",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "notif-5",
    type: "TASK_DUE",
    title: "Task Due Tomorrow",
    message: "Client meeting preparation is due tomorrow",
    userId: "1",
    read: true,
    link: "/app/tasks?task=t6",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
]

export function getNotificationsByUser(userId: string): Notification[] {
  return mockNotifications.filter((n) => n.userId === userId)
}

export function getUnreadNotificationsCount(userId: string): number {
  return mockNotifications.filter((n) => n.userId === userId && !n.read).length
}

export function markNotificationAsRead(id: string): void {
  const notification = mockNotifications.find((n) => n.id === id)
  if (notification) {
    notification.read = true
  }
}

export function markAllNotificationsAsRead(userId: string): void {
  mockNotifications.forEach((n) => {
    if (n.userId === userId) {
      n.read = true
    }
  })
}




