"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, CheckCheck, AlertCircle, FileText, DollarSign, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import {
  getNotificationsByUser,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/mock/notifications"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function NotificationsDropdown() {
  const router = useRouter()
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  const [notifications, setNotifications] = useState(getNotificationsByUser(user.id))
  const [unreadCount, setUnreadCount] = useState(getUnreadNotificationsCount(user.id))

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TASK_DUE":
      case "TASK_OVERDUE":
        return <FileText className="h-4 w-4" />
      case "KYC_EXPIRED":
        return <Shield className="h-4 w-4" />
      case "INVOICE_OVERDUE":
        return <DollarSign className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const handleNotificationClick = (notification: any) => {
    markNotificationAsRead(notification.id)
    setNotifications([...getNotificationsByUser(user.id)])
    setUnreadCount(getUnreadNotificationsCount(user.id))
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead(user.id)
    setNotifications([...getNotificationsByUser(user.id)])
    setUnreadCount(0)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute top-1 right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer rounded-md",
                    !notification.read && "bg-muted/50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn(
                    "mt-0.5",
                    !notification.read ? "text-primary" : "text-muted-foreground"
                  )}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm font-medium",
                        !notification.read && "font-semibold"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(notification.createdAt, "MMM d, h:mm a")}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button variant="ghost" className="w-full justify-center" onClick={() => router.push("/app/alerts")}>
            View all notifications
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}




