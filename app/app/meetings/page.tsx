"use client"

import { useState } from "react"
import { getAllMeetings } from "@/lib/mock/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { useUIStore } from "@/lib/store"
import { MeetingsList } from "@/components/meetings/meetings-list"
import { UploadMeetingModal } from "@/components/meetings/upload-meeting-modal"
import { ImportMeetingModal } from "@/components/meetings/import-meeting-modal"
import { MeetingGate } from "@/components/meetings/meeting-gate"

export default function MeetingsPage() {
  const { currentRole } = useRole()
  const setRecordMeetingOpen = useUIStore((s) => s.setRecordMeetingOpen)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const meetings = getAllMeetings()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Meetings & transcripts</h1>
        <p className="text-muted-foreground mt-1">
          Search and manage meeting recordings, transcripts, and notes across clients.
        </p>
      </div>

      <MeetingGate permission="meetingsRead">
        <MeetingsList
          meetings={meetings}
          showActions={true}
          onRecordClick={hasMeetingPermission(currentRole, "meetingsRecord") ? () => setRecordMeetingOpen(true) : undefined}
          onUploadClick={hasMeetingPermission(currentRole, "meetingsUpload") ? () => setUploadOpen(true) : undefined}
          onImportClick={() => setImportOpen(true)}
        />
      </MeetingGate>

      {hasMeetingPermission(currentRole, "meetingsUpload") && (
        <UploadMeetingModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          requireClientSelection={true}
        />
      )}
      <ImportMeetingModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
