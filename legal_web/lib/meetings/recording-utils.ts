export const ORPHAN_AGE_MS = 60 * 60 * 1000 // 60 minutes

/** True when the current route is the live recording page for this meeting. */
export function isActiveMeetingPath(pathname: string, meetingId: string): boolean {
  const base = `/app/meetings/${meetingId}`
  return pathname === base || pathname === `${base}/`
}

export function isOrphanedRecording(meeting: {
  status: string
  startAt: Date | string
}): boolean {
  return (
    meeting.status === "recording" &&
    Date.now() - new Date(meeting.startAt).getTime() > ORPHAN_AGE_MS
  )
}
