"use client"

import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { getAllUrgentAlerts, mockAlerts } from "@/lib/mock/alerts"
import { AlertCard } from "@/components/dashboard/alert-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AlertsPage() {
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  
  const allAlerts = mockAlerts
  const userAlerts = allAlerts.filter((a) => a.assignedToId === user.id)
  const criticalAlerts = allAlerts.filter((a) => a.severity === "Critical")
  const highAlerts = allAlerts.filter((a) => a.severity === "High")
  
  const alertsToShow = currentRole === "PARTNER_ADMIN" ? allAlerts : userAlerts

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Alerts</h1>
        <p className="text-muted-foreground">
          {currentRole === "PARTNER_ADMIN" 
            ? "View all firm alerts and notifications"
            : "View your assigned alerts and notifications"}
        </p>
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
                  key={alert.id}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  matterTitle={alert.matterTitle}
                  taskTitle={alert.taskTitle}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
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
                  key={alert.id}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  matterTitle={alert.matterTitle}
                  taskTitle={alert.taskTitle}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
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
                  key={alert.id}
                  id={alert.id}
                  title={alert.title}
                  description={alert.description}
                  severity={alert.severity}
                  matterTitle={alert.matterTitle}
                  taskTitle={alert.taskTitle}
                  dueAt={alert.dueAt}
                  assignedToName={currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

