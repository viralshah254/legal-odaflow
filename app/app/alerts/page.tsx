"use client"

import { useState, useEffect } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { getAllUrgentAlerts, mockAlerts } from "@/lib/mock/alerts"
import { AlertCard } from "@/components/dashboard/alert-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoleGate } from "@/components/dashboard/role-gate"
import { getAllAlertActions } from "@/lib/mock/alert-actions"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"

export default function AlertsPage() {
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  const [refreshKey, setRefreshKey] = useState(0)
  
  const allAlerts = mockAlerts.filter((a) => !a.acknowledged)
  const userAlerts = allAlerts.filter((a) => a.assignedToId === user.id)
  const criticalAlerts = allAlerts.filter((a) => a.severity === "Critical")
  const highAlerts = allAlerts.filter((a) => a.severity === "High")
  
  const alertsToShow = currentRole === "PARTNER_ADMIN" ? allAlerts : userAlerts

  const handleAction = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alerts</h1>
          <p className="text-muted-foreground">
            {currentRole === "PARTNER_ADMIN" 
              ? "View all firm alerts and notifications"
              : "View your assigned alerts and notifications"}
          </p>
        </div>
        <OpenCopilotButton />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({alertsToShow.length})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({criticalAlerts.length})</TabsTrigger>
          <TabsTrigger value="high">High ({highAlerts.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {alertsToShow.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No alerts</p>
                </CardContent>
              </Card>
            ) : (
              alertsToShow.map((alert) => (
                <AlertCard
                  key={`${alert.id}-${refreshKey}`}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  type={alert.type}
                  matterId={alert.matterId}
                  matterTitle={alert.matterTitle}
                  taskId={alert.taskId}
                  taskTitle={alert.taskTitle}
                  clientId={alert.clientId}
                  clientName={alert.clientName}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
                  acknowledged={alert.acknowledged}
                  onAction={handleAction}
                />
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="critical" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {criticalAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No critical alerts</p>
                </CardContent>
              </Card>
            ) : (
              criticalAlerts.map((alert) => (
                <AlertCard
                  key={`${alert.id}-${refreshKey}`}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  type={alert.type}
                  matterId={alert.matterId}
                  matterTitle={alert.matterTitle}
                  taskId={alert.taskId}
                  taskTitle={alert.taskTitle}
                  clientId={alert.clientId}
                  clientName={alert.clientName}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
                  acknowledged={alert.acknowledged}
                  onAction={handleAction}
                />
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="high" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {highAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No high priority alerts</p>
                </CardContent>
              </Card>
            ) : (
              highAlerts.map((alert) => (
                <AlertCard
                  key={`${alert.id}-${refreshKey}`}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  type={alert.type}
                  matterId={alert.matterId}
                  matterTitle={alert.matterTitle}
                  taskId={alert.taskId}
                  taskTitle={alert.taskTitle}
                  clientId={alert.clientId}
                  clientName={alert.clientName}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
                  acknowledged={alert.acknowledged}
                  onAction={handleAction}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Alert Action History - Admin Only */}
      <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Alert Action History</CardTitle>
            <CardDescription>Track all alert actions taken by team members</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {getAllAlertActions().length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No alert actions recorded yet</p>
                ) : (
                  getAllAlertActions().map((action) => (
                    <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={
                              action.actionType === "COMPLETED"
                                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                : action.actionType === "SKIPPED"
                                ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                            }
                          >
                            {action.actionType}
                          </Badge>
                          <span className="text-sm font-medium">{action.userName}</span>
                          <span className="text-xs text-muted-foreground">
                            on alert: {action.alertId}
                          </span>
                        </div>
                        {action.notes && (
                          <p className="text-xs text-muted-foreground">{action.notes}</p>
                        )}
                        {action.navigationPath && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Navigated to: {action.navigationPath}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(action.timestamp, "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </RoleGate>
    </div>
  )
}

