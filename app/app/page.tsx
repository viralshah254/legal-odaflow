"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { clientsApi, mattersApi, tasksApi, invoicesApi, notificationsApi } from "@/lib/mock-api"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Users, FileText, CheckSquare, AlertTriangle, Receipt, Shield, Clock } from "lucide-react"
import type { Client, Matter, Task, Invoice, Notification } from "@/lib/types"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    clients: 0,
    matters: 0,
    tasksDueToday: 0,
    overdueTasks: 0,
    outstandingInvoices: 0,
    trustBalance: 0,
  })
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])

  useEffect(() => {
    async function loadData() {
      const [clients, matters, tasksToday, tasksOverdue, invoices, notifications] = await Promise.all([
        clientsApi.listClients(),
        mattersApi.listMatters(),
        tasksApi.listTasks({ dueToday: true }),
        tasksApi.listTasks({ overdue: true }),
        invoicesApi.listInvoices({ status: "SENT" }),
        notificationsApi.listNotifications("user-1"),
      ])

      setStats({
        clients: clients.length,
        matters: matters.length,
        tasksDueToday: tasksToday.length,
        overdueTasks: tasksOverdue.length,
        outstandingInvoices: invoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0),
        trustBalance: 50000, // Mock value
      })
      setRecentTasks([...tasksToday, ...tasksOverdue].slice(0, 5))
      setRecentNotifications(notifications.slice(0, 5))
    }
    loadData()
  }, [])

  return (
    <div className="p-6 sm:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-lg">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{stats.clients}</div>
            <Link href="/app/clients" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all clients →
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Matters</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{stats.matters}</div>
            <Link href="/app/matters" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all matters →
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Due Today</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Clock className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{stats.tasksDueToday}</div>
            {stats.overdueTasks > 0 ? (
              <p className="text-xs text-destructive font-semibold">
                {stats.overdueTasks} overdue
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">All caught up</p>
            )}
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Invoices</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{formatCurrency(stats.outstandingInvoices)}</div>
            <Link href="/app/accounting/invoices" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View invoices →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* My Work */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">My Work</CardTitle>
            <CardDescription>Tasks requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <div className="py-8 text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No tasks due today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link href={`/app/tasks`} className="font-medium hover:text-primary transition-colors block truncate">
                          {task.title}
                        </Link>
                        {task.matter && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {task.matter.title}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={task.priority === "CRITICAL" ? "destructive" : "secondary"} className="text-xs">
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Due {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Link href="/app/tasks">
                  <Button variant="outline" className="w-full mt-4">View All Tasks</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Recent Notifications</CardTitle>
            <CardDescription>Latest updates and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{notif.title}</p>
                          {!notif.read && (
                            <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Link href="/app/notifications">
                  <Button variant="outline" className="w-full mt-4">View All Notifications</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

