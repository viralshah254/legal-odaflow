"use client"

import { useRouter } from "next/navigation"

import type { Meeting } from "@/lib/types/meetings"
import type { UserRole } from "@/lib/types/roles"
import { hasMeetingPermission } from "@/lib/types/roles"
import { ImportMeetingModal } from "@/components/meetings/import-meeting-modal"
import { MeetingGate } from "@/components/meetings/meeting-gate"
import { MeetingsList } from "@/components/meetings/meetings-list"
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal"
import { RecorderPanel } from "@/components/meetings/recorder-panel"
import { UploadMeetingModal } from "@/components/meetings/upload-meeting-modal"

interface ClientMeetingsPanelProps {
  clientId: string
  currentRole: UserRole
  recordingMeeting: Meeting | null
  onRecordingMeetingChange: (meeting: Meeting | null) => void
  newMeetingOpen: boolean
  onNewMeetingOpenChange: (open: boolean) => void
  uploadOpen: boolean
  onUploadOpenChange: (open: boolean) => void
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  onTotalChange: (total: number, hasError?: boolean) => void
}

export function ClientMeetingsPanel({
  clientId,
  currentRole,
  recordingMeeting,
  onRecordingMeetingChange,
  newMeetingOpen,
  onNewMeetingOpenChange,
  uploadOpen,
  onUploadOpenChange,
  importOpen,
  onImportOpenChange,
  onTotalChange,
}: ClientMeetingsPanelProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {recordingMeeting ? (
        <RecorderPanel
          meeting={recordingMeeting}
          onClose={() => onRecordingMeetingChange(null)}
          onNavigateToMeeting={(id) => {
            onRecordingMeetingChange(null)
            router.push(`/app/meetings/${id}`)
          }}
        />
      ) : null}
      <MeetingGate permission="meetingsRead">
        <MeetingsList
          clientId={clientId}
          onTotalChange={onTotalChange}
          showActions
          onRecordClick={
            hasMeetingPermission(currentRole, "meetingsRecord")
              ? () => onNewMeetingOpenChange(true)
              : undefined
          }
          onUploadClick={
            hasMeetingPermission(currentRole, "meetingsUpload")
              ? () => onUploadOpenChange(true)
              : undefined
          }
          onImportClick={() => onImportOpenChange(true)}
        />
      </MeetingGate>
      <MeetingGate permission="meetingsRecord">
        <NewMeetingModal
          open={newMeetingOpen}
          onOpenChange={onNewMeetingOpenChange}
          initialClientId={clientId}
          requireClientSelection={false}
          onStartRecording={(meeting) => {
            onNewMeetingOpenChange(false)
            onRecordingMeetingChange(meeting)
          }}
        />
      </MeetingGate>
      <MeetingGate permission="meetingsUpload">
        <UploadMeetingModal
          open={uploadOpen}
          onOpenChange={onUploadOpenChange}
          initialClientId={clientId}
          requireClientSelection={false}
          onUploadComplete={(id) => router.push(`/app/meetings/${id}`)}
        />
      </MeetingGate>
      <ImportMeetingModal open={importOpen} onOpenChange={onImportOpenChange} />
    </div>
  )
}
