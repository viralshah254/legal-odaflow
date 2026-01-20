"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mattersApi } from "@/lib/mock-api"
import { formatDate } from "@/lib/utils"
import type { Matter } from "@/lib/types"
import { ArrowLeft, Plus } from "lucide-react"

export default function MatterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const matterId = params.matterId as string
  const [matter, setMatter] = useState<Matter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatter() {
      setLoading(true)
      const data = await mattersApi.getMatter(matterId)
      setMatter(data)
      setLoading(false)
    }
    loadMatter()
  }, [matterId])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!matter) {
    return <div className="p-6">Matter not found</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/matters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{matter.title}</h1>
          <p className="text-muted-foreground">{matter.ref}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Upload Doc
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Stage Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {['INTAKE', 'CONFLICT_CHECK', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'].map((stage) => (
              <Badge
                key={stage}
                variant={matter.stage === stage ? "default" : "outline"}
                className="cursor-pointer"
              >
                {stage.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="parties">Parties</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Matter Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Client: </span>
                    <Link href={`/app/clients/${matter.clientId}`} className="text-primary hover:underline">
                      {matter.client?.name}
                    </Link>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Type: </span>
                    <span>{matter.type}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status: </span>
                    <Badge>{matter.status}</Badge>
                  </div>
                  {matter.advocate && (
                    <div>
                      <span className="text-sm text-muted-foreground">Advocate: </span>
                      <span>{matter.advocate.name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {matter.keyDates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Dates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {matter.keyDates.map((date) => (
                        <div key={date.id} className="flex items-center justify-between">
                          <span className="text-sm">{date.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(date.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tasks">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Tasks will be displayed here
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Documents will be displayed here
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parties">
              <Card>
                <CardHeader>
                  <CardTitle>Parties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {matter.parties.map((party) => (
                      <div key={party.id} className="flex items-center justify-between py-2 border-b">
                        <div>
                          <div className="font-medium">{party.name}</div>
                          <div className="text-sm text-muted-foreground">{party.role}</div>
                        </div>
                        <Badge variant="outline">{party.type}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Billing information will be displayed here
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Rail */}
        <div className="space-y-4">
          {matter.nextDeadline && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Next Deadline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium">{formatDate(matter.nextDeadline)}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

