"use client"

import { useState } from "react"
import { use } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { getMatterById, mockMatters, Matter } from "@/lib/mock/matters"
import { getTimelineEventsByMatter } from "@/lib/mock/timeline"
import { getAssistanceRequestsByMatter } from "@/lib/mock/assistance"
import { TransferCaseDialog } from "@/components/matters/transfer-case-dialog"
import { RequestAssistanceDialog } from "@/components/matters/request-assistance-dialog"
import { MatterTimeline } from "@/components/matters/matter-timeline"
import { CollaboratorsPanel } from "@/components/matters/collaborators-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, ArrowRightLeft, Users, Clock, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { RoleGate } from "@/components/dashboard/role-gate"
import { cn } from "@/lib/utils"

export default function MatterDetailPage({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = use(params)
  const { currentUser, currentRole } = useRole()
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [assistanceDialogOpen, setAssistanceDialogOpen] = useState(false)

  const matter = getMatterById(matterId)
  if (!matter) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Matter not found</p>
            <Link href="/app/matters">
              <Button variant="outline" className="mt-4">
                Back to Matters
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const timelineEvents = getTimelineEventsByMatter(matterId)
  const assistanceRequests = getAssistanceRequestsByMatter(matterId)
  const isOwner = matter.ownerId === currentUser?.id
  const canTransfer = currentRole === "PARTNER_ADMIN" || (currentRole === "ASSOCIATE" && isOwner)

  const getRiskColor = (risk: Matter["risk"]) => {
    switch (risk) {
      case "Critical":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
      case "High":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20"
      case "Medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
      default:
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    }
  }

  const stages = ["Intake", "Active", "Discovery", "Negotiation", "Closing", "Closed"]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Link href="/app/matters">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{matter.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">{matter.ref}</Badge>
              <Badge variant="outline" className={cn(getRiskColor(matter.risk))}>
                {matter.risk} Risk
              </Badge>
              <span className="text-sm text-muted-foreground">
                Owner: {matter.ownerName}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
            {canTransfer && (
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(true)}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Case
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setAssistanceDialogOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Request Assistance
            </Button>
          </RoleGate>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Upload Doc
          </Button>
        </div>
      </div>

      {/* Stage Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {stages.map((stage) => (
              <Badge
                key={stage}
                variant={matter.stage === stage ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  matter.stage === stage && "shadow-md"
                )}
              >
                {stage}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Matter Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Client: </span>
                    <Link href={`/app/clients/${matter.clientId}`} className="text-primary hover:underline font-medium">
                      {matter.clientName}
                    </Link>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Stage: </span>
                    <Badge>{matter.stage}</Badge>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status: </span>
                    <Badge variant={matter.status === "Active" ? "default" : "secondary"}>
                      {matter.status}
                    </Badge>
                  </div>
                  {matter.teamName && (
                    <div>
                      <span className="text-sm text-muted-foreground">Team: </span>
                      <span>{matter.teamName}</span>
                    </div>
                  )}
                  {matter.nextDeadline && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Next Deadline: </span>
                        <span className="font-medium">
                          {format(new Date(matter.nextDeadline), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assistance Requests */}
              {assistanceRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assistance Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assistanceRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-start justify-between p-3 rounded-lg border border-border/50"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">
                              Requested by {request.requestedByName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Helpers: {request.helperNames.join(", ")}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Type: {request.assistanceType} • Scope: {request.accessScope}
                            </div>
                          </div>
                          <Badge
                            variant={
                              request.status === "APPROVED"
                                ? "default"
                                : request.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-6">
              <MatterTimeline events={timelineEvents} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-6">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Tasks will be displayed here
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Documents will be displayed here
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Rail */}
        <div className="space-y-6">
          <CollaboratorsPanel matter={matter} />

          {matter.nextDeadline && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Next Deadline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-lg">
                  {format(new Date(matter.nextDeadline), "MMM d, yyyy")}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(matter.nextDeadline), "EEEE")}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TransferCaseDialog
        matterId={matterId}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onTransferComplete={() => {
          // Refresh page data
          window.location.reload()
        }}
      />

      <RequestAssistanceDialog
        matterId={matterId}
        open={assistanceDialogOpen}
        onOpenChange={setAssistanceDialogOpen}
        onRequestComplete={() => {
          // Refresh page data
          window.location.reload()
        }}
      />
    </div>
  )
}
