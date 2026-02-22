"use client"

import { useRouter } from "next/navigation"
import { useUIStore } from "@/lib/store"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { getMeetingById } from "@/lib/mock/meetings"
import { NewMeetingModal } from "./new-meeting-modal"
import { RecorderPanel } from "./recorder-panel"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function GlobalRecordMeeting() {
  const router = useRouter()
  const { currentRole } = useRole()
  const { recordMeetingOpen, setRecordMeetingOpen, recordingMeetingId, setRecordingMeetingId } = useUIStore()

  const canRecord = hasMeetingPermission(currentRole, "meetingsRecord")
  const meeting = recordingMeetingId ? getMeetingById(recordingMeetingId) : null

  if (!canRecord) return null

  return (
    <>
      <NewMeetingModal
        open={recordMeetingOpen}
        onOpenChange={setRecordMeetingOpen}
        requireClientSelection={true}
        onStartRecording={(m) => {
          setRecordMeetingOpen(false)
          setRecordingMeetingId(m.id)
        }}
      />
      <Sheet open={!!recordingMeetingId} onOpenChange={(open) => !open && setRecordingMeetingId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          {meeting && (
            <RecorderPanel
              meeting={meeting}
              onClose={() => setRecordingMeetingId(null)}
              onNavigateToMeeting={(id) => {
                setRecordingMeetingId(null)
                router.push(`/app/meetings/${id}`)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
