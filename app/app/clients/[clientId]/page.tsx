"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clientsApi, mattersApi, tasksApi, invoicesApi } from "@/lib/mock-api"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Client, Matter, Task, Invoice } from "@/lib/types"
import { ArrowLeft, Mail, Phone, MapPin, AlertTriangle, FileText, CheckSquare, Receipt } from "lucide-react"

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.clientId as string
  const [client, setClient] = useState<Client | null>(null)
  const [matters, setMatters] = useState<Matter[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [clientData, mattersData, tasksData, invoicesData] = await Promise.all([
        clientsApi.getClient(clientId),
        mattersApi.listMatters({ clientId }),
        tasksApi.listTasks({ clientId }),
        invoicesApi.listInvoices({ clientId }),
      ])
      setClient(clientData)
      setMatters(mattersData)
      setTasks(tasksData)
      setInvoices(invoicesData)
      setLoading(false)
    }
    loadData()
  }, [clientId])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!client) {
    return <div className="p-6">Client not found</div>
  }

  const outstandingInvoices = invoices.filter(i => i.status === "SENT")
  const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0)
  const overdueTasks = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "COMPLETED")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground">{client.type}</p>
        </div>
        <Button onClick={() => router.push(`/app/clients/${clientId}/edit`)}>
          Edit Client
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Matters</CardDescription>
            <CardTitle className="text-2xl">{matters.filter(m => m.status === "ACTIVE").length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming Deadlines</CardDescription>
            <CardTitle className="text-2xl">
              {tasks.filter(t => new Date(t.dueDate) >= new Date() && t.status !== "COMPLETED").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing KYC</CardDescription>
            <CardTitle className="text-2xl">
              {client.kycStatus === "MISSING" ? "Yes" : "No"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(outstandingAmount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="matters">Matters</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div>{client.address.street}</div>
                        <div>
                          {client.address.city}, {client.address.state} {client.address.zipCode}
                        </div>
                        <div>{client.address.country}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>KYC Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={client.kycStatus === "VERIFIED" ? "default" : "destructive"}>
                      {client.kycStatus}
                    </Badge>
                    {client.kycStatus !== "VERIFIED" && (
                      <Button variant="outline" size="sm">
                        Request Documents
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matters" className="space-y-4">
              {matters.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No matters found
                  </CardContent>
                </Card>
              ) : (
                matters.map((matter) => (
                  <Card key={matter.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{matter.title}</CardTitle>
                          <CardDescription>{matter.ref}</CardDescription>
                        </div>
                        <Badge>{matter.stage}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Type: {matter.type}</span>
                        <span>Status: {matter.status}</span>
                        {matter.nextDeadline && (
                          <span>Next: {formatDate(matter.nextDeadline)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              {tasks.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No tasks found
                  </CardContent>
                </Card>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        <Badge variant={task.priority === "CRITICAL" ? "destructive" : "secondary"}>
                          {task.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Due: {formatDate(task.dueDate)}</span>
                        <span>Status: {task.status}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Documents will be displayed here
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              {invoices.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No invoices found
                  </CardContent>
                </Card>
              ) : (
                invoices.map((invoice) => (
                  <Card key={invoice.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{invoice.number}</CardTitle>
                          <CardDescription>{formatDate(invoice.issueDate)}</CardDescription>
                        </div>
                        <Badge>{invoice.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Total: {formatCurrency(invoice.total)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Paid: {formatCurrency(invoice.paidAmount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks
                .filter(t => new Date(t.dueDate) >= new Date() && t.status !== "COMPLETED")
                .slice(0, 5)
                .map((task) => (
                  <div key={task.id} className="py-2 border-b last:border-0">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(task.dueDate)}
                    </div>
                  </div>
                ))}
              {tasks.filter(t => new Date(t.dueDate) >= new Date() && t.status !== "COMPLETED").length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
              )}
            </CardContent>
          </Card>

          {overdueTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Overdue Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {overdueTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="py-2 border-b last:border-0">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {formatDate(task.dueDate)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {outstandingInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Outstanding Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {outstandingInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="py-2 border-b last:border-0">
                    <div className="font-medium text-sm">{invoice.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(invoice.total - invoice.paidAmount)} outstanding
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

