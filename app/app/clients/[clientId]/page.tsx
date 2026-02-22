"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getClientById, mockClients } from "@/lib/mock/clients"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { getKycChecklist, updateKycDocument } from "@/lib/mock/kyc"
import { mockMatters } from "@/lib/mock/matters"
import { getMeetingsByClient } from "@/lib/mock/meetings"
import { KycChecklistCard } from "@/components/dashboard/kyc-checklist-card"
import { KycUploadTable } from "@/components/dashboard/kyc-upload-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MattersTableMini } from "@/components/dashboard/matters-table-mini"
import { Building2, Mail, Phone, MapPin, FileText, Mic } from "lucide-react"
import { notFound } from "next/navigation"
import type { Meeting } from "@/lib/types/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { MeetingGate } from "@/components/meetings/meeting-gate"
import { MeetingsList } from "@/components/meetings/meetings-list"
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal"
import { RecorderPanel } from "@/components/meetings/recorder-panel"
import { UploadMeetingModal } from "@/components/meetings/upload-meeting-modal"
import { ImportMeetingModal } from "@/components/meetings/import-meeting-modal"

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> | { clientId: string } }) {
  let clientId: string
  if (params instanceof Promise) {
    const resolvedParams = use(params)
    clientId = resolvedParams.clientId
  } else {
    clientId = params.clientId
  }

  const router = useRouter()
  const client = getClientById(clientId)
  const { setClientId } = useCopilotContext()
  const { currentRole } = useRole()

  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [recordingMeeting, setRecordingMeeting] = useState<Meeting | null>(null)

  const clientMeetings = getMeetingsByClient(clientId)

  useEffect(() => {
    if (clientId) setClientId(clientId)
    return () => setClientId(undefined)
  }, [clientId, setClientId])

  if (!client) {
    notFound()
  }

  const kycChecklist = getKycChecklist(clientId)
  const clientMatters = mockMatters.filter((m) => m.clientId === clientId)

  const handleKycUpdate = (docId: string, updates: Partial<import("@/lib/types/kyc").KycDocument>) => {
    updateKycDocument(clientId, docId, updates)
    // Force re-render by updating state (in a real app, this would be handled by state management)
    window.location.reload()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{client.name}</h1>
          <p className="text-muted-foreground">{client.type} Client</p>
        </div>
        <OpenCopilotButton />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC & Compliance</TabsTrigger>
          <TabsTrigger value="matters">Matters</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Type</div>
                    <div className="font-medium">{client.type}</div>
                  </div>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div className="font-medium">{client.email}</div>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div className="font-medium">{client.phone}</div>
                    </div>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Address</div>
                      <div className="font-medium">{client.address}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {kycChecklist && (
              <KycChecklistCard checklist={kycChecklist} clientName={client.name} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="kyc" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>KYC Documents</CardTitle>
              <CardDescription>
                Upload and manage KYC documents for {client.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kycChecklist ? (
                <KycUploadTable
                  documents={kycChecklist.documents}
                  onUpdate={handleKycUpdate}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No KYC checklist found. Please initialize KYC for this client.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matters" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Related Matters</CardTitle>
              <CardDescription>All matters associated with this client</CardDescription>
            </CardHeader>
            <CardContent>
              {clientMatters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No matters found for this client
                </div>
              ) : (
                <MattersTableMini matters={clientMatters} showOwner={true} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="mt-6 space-y-6">
          {recordingMeeting && (
            <RecorderPanel
              meeting={recordingMeeting}
              onClose={() => setRecordingMeeting(null)}
              onNavigateToMeeting={(id) => {
                setRecordingMeeting(null)
                router.push(`/app/meetings/${id}`)
              }}
            />
          )}
          <MeetingGate permission="meetingsRead">
            <MeetingsList
              meetings={clientMeetings}
              clientId={clientId}
              showActions={true}
              onRecordClick={hasMeetingPermission(currentRole, "meetingsRecord") ? () => setNewMeetingOpen(true) : undefined}
              onUploadClick={hasMeetingPermission(currentRole, "meetingsUpload") ? () => setUploadOpen(true) : undefined}
              onImportClick={() => setImportOpen(true)}
            />
          </MeetingGate>
          <MeetingGate permission="meetingsRecord">
            <NewMeetingModal
              open={newMeetingOpen}
              onOpenChange={setNewMeetingOpen}
              initialClientId={clientId}
              requireClientSelection={false}
              onStartRecording={(meeting) => {
                setNewMeetingOpen(false)
                setRecordingMeeting(meeting)
              }}
            />
          </MeetingGate>
          <MeetingGate permission="meetingsUpload">
            <UploadMeetingModal
              open={uploadOpen}
              onOpenChange={setUploadOpen}
              initialClientId={clientId}
              requireClientSelection={false}
              onUploadComplete={(id) => router.push(`/app/meetings/${id}`)}
            />
          </MeetingGate>
          <ImportMeetingModal open={importOpen} onOpenChange={setImportOpen} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
