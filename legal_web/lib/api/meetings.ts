import { apiFetch, authorizedFetch } from "./client"
import { validateUploadFile } from "@/lib/security/validate-upload-file"

export interface ApiMeeting {
  id: string
  tenantId: string
  clientId: string | null
  matterId?: string | null
  title: string
  description?: string | null
  startAt: string | null
  endAt?: string | null
  createdByUserId: string | null
  participants?: string[]
  source: string
  confidentiality?: string
  status: string
  tags?: string[]
  durationMs?: number | null
  createdAt: string
  updatedAt: string
}

export interface ApiMeetingTranscript {
  id: string
  meetingId: string
  version: number
  language: string
  segments?: Array<{
    startMs: number
    endMs: number
    speakerLabel: string
    text: string
  }>
  rawText?: string | null
  createdAt: string
}

export interface ApiMeetingNote {
  id: string
  meetingId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateMeetingRequest {
  clientId: string
  matterId?: string
  title: string
  description?: string
  scheduledAt: string
  endAt?: string
  source?: string
  status?: string
  participants?: string[]
  confidentiality?: string
}

export async function listMeetings(
  tenantId: string,
  params?: {
    matterId?: string
    clientId?: string
    q?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    limit?: number
  },
): Promise<ApiMeeting[]> {
  const search = new URLSearchParams()
  if (params?.matterId) search.set("matterId", params.matterId)
  if (params?.clientId) search.set("clientId", params.clientId)
  if (params?.q) search.set("q", params.q)
  if (params?.status) search.set("status", params.status)
  if (params?.dateFrom) search.set("dateFrom", params.dateFrom)
  if (params?.dateTo) search.set("dateTo", params.dateTo)
  if (params?.page) search.set("page", String(params.page))
  if (params?.limit) search.set("limit", String(params.limit))
  const query = search.toString() ? `?${search.toString()}` : ""
  const data = await apiFetch<ApiMeeting[] | MeetingsPageResponse>(`/meetings${query}`, { tenantId })
  if (Array.isArray(data)) return data
  return data.items
}

export interface MeetingsPageResponse {
  items: ApiMeeting[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export async function listMeetingsPage(
  tenantId: string,
  params?: {
    matterId?: string
    clientId?: string
    q?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    limit?: number
  },
): Promise<MeetingsPageResponse> {
  const search = new URLSearchParams()
  if (params?.matterId) search.set("matterId", params.matterId)
  if (params?.clientId) search.set("clientId", params.clientId)
  if (params?.q) search.set("q", params.q)
  if (params?.status) search.set("status", params.status)
  if (params?.dateFrom) search.set("dateFrom", params.dateFrom)
  if (params?.dateTo) search.set("dateTo", params.dateTo)
  search.set("page", String(params?.page ?? 1))
  search.set("limit", String(params?.limit ?? 20))
  return apiFetch<MeetingsPageResponse>(`/meetings?${search.toString()}`, { tenantId })
}

export async function getMeeting(
  tenantId: string,
  meetingId: string,
): Promise<ApiMeeting> {
  return apiFetch<ApiMeeting>(`/meetings/${meetingId}`, { tenantId })
}

export async function createMeeting(
  tenantId: string,
  data: CreateMeetingRequest,
): Promise<ApiMeeting> {
  return apiFetch<ApiMeeting>("/meetings", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateMeetingStatus(
  tenantId: string,
  meetingId: string,
  status: string,
): Promise<ApiMeeting> {
  return apiFetch<ApiMeeting>(`/meetings/${meetingId}`, {
    method: "PATCH",
    tenantId,
    body: { status },
  })
}

export async function deleteMeeting(
  tenantId: string,
  meetingId: string,
): Promise<void> {
  await apiFetch<void>(`/meetings/${meetingId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function getMeetingTranscript(
  tenantId: string,
  meetingId: string,
): Promise<ApiMeetingTranscript | null> {
  return apiFetch<ApiMeetingTranscript | null>(
    `/meetings/${meetingId}/transcript`,
    { tenantId },
  )
}

export async function getMeetingNotes(
  tenantId: string,
  meetingId: string,
): Promise<ApiMeetingNote[]> {
  return apiFetch<ApiMeetingNote[]>(`/meetings/${meetingId}/notes`, {
    tenantId,
  })
}

export async function finishRecordingAndProcess(
  tenantId: string,
  meetingId: string,
): Promise<{ status: string; skipped?: boolean }> {
  return apiFetch<{ status: string; skipped?: boolean }>(`/meetings/${meetingId}/process`, {
    method: "POST",
    tenantId,
  })
}

/** Re-enqueue Whisper + notes for a meeting that already has saved audio. Idempotent. */
export async function retryMeetingProcessing(
  tenantId: string,
  meetingId: string,
): Promise<{ status: string; skipped?: boolean }> {
  return finishRecordingAndProcess(tenantId, meetingId)
}

export async function uploadMeetingAudio(
  tenantId: string,
  meetingId: string,
  audioBlob: Blob,
  durationMs: number,
  draftTranscript?: string,
): Promise<{ status: string }> {
  const file =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "recording.webm", {
          type: audioBlob.type || "video/webm",
        })
  await validateUploadFile(file, "meetingAudio")
  const form = new FormData()
  form.append("audio", audioBlob, "recording.webm")
  form.append("durationMs", String(durationMs))
  if (draftTranscript) form.append("draftTranscript", draftTranscript)

  return apiFetch<{ status: string }>(`/meetings/${meetingId}/process`, {
    method: "POST",
    tenantId,
    body: form,
  })
}

export {
  getMeetingRecordingAccess,
  buildMeetingRecordingStreamUrl,
  resolveMeetingRecordingSrc,
} from "@/lib/meetings/recording-playback"
export type { MeetingRecordingAccess } from "@/lib/meetings/recording-playback"

/**
 * Fetches the full recording into memory — prefer resolveMeetingRecordingSrc for playback.
 */
export async function getMeetingAudioBlobUrl(
  tenantId: string,
  meetingId: string,
): Promise<string> {
  const response = await authorizedFetch(`/meetings/${meetingId}/audio/`, {
    tenantId,
  })
  if (!response.ok) throw new Error("Audio not available")
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function regenerateMeetingNotes(
  tenantId: string,
  meetingId: string,
): Promise<ApiMeetingNote> {
  return apiFetch<ApiMeetingNote>(`/meetings/${meetingId}/summarize`, {
    method: "POST",
    tenantId,
  })
}
