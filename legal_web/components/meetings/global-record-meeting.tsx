"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUIStore } from "@/lib/store"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { NewMeetingModal } from "./new-meeting-modal"
import { FloatingRecorderBar } from "./floating-recorder-bar"
import { useMeetingRecordingStore } from "@/lib/store/meeting-recording-store"
import { isActiveMeetingPath, isOrphanedRecording } from "@/lib/meetings/recording-utils"

export function GlobalRecordMeeting() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentRole } = useRole()
  const {
    recordMeetingOpen,
    setRecordMeetingOpen,
    initialRecordClientId,
    initialRecordMatterId,
    setInitialRecordContext,
  } = useUIStore()

  const activeMeeting = useMeetingRecordingStore((s) => s.activeMeeting)
  const includeVideo = useMeetingRecordingStore((s) => s.includeVideo)
  const pendingMediaStream = useMeetingRecordingStore((s) => s.pendingMediaStream)
  const setActiveRecording = useMeetingRecordingStore((s) => s.setActiveRecording)
  const clearActiveRecording = useMeetingRecordingStore((s) => s.clearActiveRecording)
  const hydrateFromSession = useMeetingRecordingStore((s) => s.hydrateFromSession)

  // Hide the floating bar UI when the meeting page provides its own controls
  const isOnActiveMeetingPage =
    activeMeeting != null && isActiveMeetingPath(pathname, activeMeeting.id)

  useEffect(() => {
    hydrateFromSession()
  }, [hydrateFromSession])

  // Drop stale sessionStorage recordings that were never saved (e.g. after a page refresh).
  // Never clear if there is already a live media stream — that means we're actively recording.
  useEffect(() => {
    if (!activeMeeting) return
    const hasLiveStream = pendingMediaStream != null
    if (hasLiveStream) return
    if (activeMeeting.status !== "recording" || isOrphanedRecording(activeMeeting)) {
      clearActiveRecording()
    }
  }, [activeMeeting, pendingMediaStream, clearActiveRecording])

  const canRecord = hasMeetingPermission(currentRole, "meetingsRecord")
  if (!canRecord) return null

  return (
    <>
      <NewMeetingModal
        open={recordMeetingOpen}
        onOpenChange={(open) => {
          if (!open) setInitialRecordContext(null, null)
          setRecordMeetingOpen(open)
        }}
        initialClientId={initialRecordClientId ?? undefined}
        initialMatterId={initialRecordMatterId ?? undefined}
        requireClientSelection={!initialRecordClientId}
        onStartRecording={(m, options) => {
          setRecordMeetingOpen(false)
          setInitialRecordContext(null, null)
          setActiveRecording(m, {
            includeVideo: options?.includeVideo ?? false,
            mediaStream: options?.mediaStream,
          })
          // Let the recorder mount and attach the pre-acquired stream before navigation.
          requestAnimationFrame(() => {
            router.push(`/app/meetings/${m.id}`)
          })
        }}
      />

      {activeMeeting && (
        <FloatingRecorderBar
          meeting={activeMeeting}
          includeVideo={includeVideo}
          hideUI={isOnActiveMeetingPage}
          onClose={clearActiveRecording}
        />
      )}
    </>
  )
}
