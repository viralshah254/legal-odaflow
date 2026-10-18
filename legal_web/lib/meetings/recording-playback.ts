import { apiFetch } from "@/lib/api/client"

export interface MeetingRecordingAccess {
  recordingToken: string
  /** Direct S3 presigned URL — browser range-requests skip the API proxy entirely. */
  streamUrl: string | null
  mimeType: string
  isVideo: boolean
}

const SESSION_KEY = (meetingId: string) => `meeting-recording-access-v2:${meetingId}`

/** Reuse access payload in sessionStorage so stream URLs stay stable for HTTP caching. */
export async function getMeetingRecordingAccess(
  tenantId: string,
  meetingId: string,
): Promise<MeetingRecordingAccess> {
  if (typeof window !== "undefined") {
    const cached = sessionStorage.getItem(SESSION_KEY(meetingId))
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as MeetingRecordingAccess & { exp: number }
        if (parsed.recordingToken && parsed.exp > Date.now() + 60_000) {
          return {
            recordingToken: parsed.recordingToken,
            streamUrl: parsed.streamUrl ?? null,
            mimeType: parsed.mimeType,
            isVideo: parsed.isVideo,
          }
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY(meetingId))
      }
    }
  }

  const fresh = await apiFetch<MeetingRecordingAccess>(
    `/meetings/${meetingId}/recording-access`,
    { tenantId },
  )

  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      SESSION_KEY(meetingId),
      JSON.stringify({
        ...fresh,
        streamUrl: fresh.streamUrl ?? null,
        exp: Date.now() + 3.5 * 60 * 60 * 1000,
      }),
    )
  }

  return fresh
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")
}

/** API proxy fallback when direct S3 is unavailable (local disk recordings). */
export function buildMeetingRecordingStreamUrl(
  meetingId: string,
  recordingToken: string,
): string {
  const params = new URLSearchParams({ recording_token: recordingToken })
  const path = `/api/v1/meetings/${meetingId}/audio/?${params.toString()}`

  // Local dev: skip Next.js BFF hop — audio range requests go straight to Nest on :4000
  if (isLocalDevHost()) {
    const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "")
    return `${api}${path}`
  }

  return path
}

export async function resolveMeetingRecordingSrc(
  tenantId: string,
  meetingId: string,
): Promise<{ src: string; isVideo: boolean; revokeOnCleanup: boolean }> {
  const access = await getMeetingRecordingAccess(tenantId, meetingId)
  const src =
    access.streamUrl ?? buildMeetingRecordingStreamUrl(meetingId, access.recordingToken)
  return {
    src,
    isVideo: access.isVideo,
    revokeOnCleanup: false,
  }
}

/** Clear cached access (e.g. after re-processing) so a fresh stream URL is fetched. */
export function invalidateMeetingRecordingCache(meetingId: string): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SESSION_KEY(meetingId))
}
