/** Meeting source: in-app recording, upload, or provider import */
export type MeetingSource =
  | "manual_recording"
  | "upload"
  | "zoom"
  | "google_meet"
  | "teams"

export type MeetingStatus =
  | "draft"
  | "recording"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"

export type ConfidentialityLevel = "standard" | "restricted" | "highly_restricted"

export interface Meeting {
  id: string
  tenantId: string
  clientId: string
  matterId?: string
  title: string
  description?: string
  startAt: Date
  endAt?: Date
  createdByUserId: string
  participants: string[]
  source: MeetingSource
  confidentiality: ConfidentialityLevel
  visibilityAllowListUserIds: string[]
  status: MeetingStatus
  tags: string[]
  audioAssetId?: string
  durationMs?: number
  providerMeta?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface MeetingTranscriptSegment {
  startMs: number
  endMs: number
  speakerId: string
  speakerLabel: string
  text: string
  confidence?: number
}

export interface MeetingTranscript {
  id: string
  meetingId: string
  version: number
  language: string
  diarizationEnabled: boolean
  segments: MeetingTranscriptSegment[]
  rawText?: string
  createdAt: Date
}

export interface MeetingActionItem {
  text: string
  ownerUserId?: string
  dueDate?: Date
  status: "pending" | "in_progress" | "done"
}

export interface MeetingNotes {
  id: string
  meetingId: string
  version: number
  title: string
  attendees: string[]
  agenda: string[]
  summaryBullets: string[]
  decisions: string[]
  actionItems: MeetingActionItem[]
  risks: string[]
  openQuestions: string[]
  followUpEmailDraft?: string
  createdAt: Date
  updatedAt: Date
}

export interface MeetingEvent {
  id: string
  meetingId: string
  eventType: string
  payload: Record<string, unknown>
  actorUserId: string
  createdAt: Date
}
