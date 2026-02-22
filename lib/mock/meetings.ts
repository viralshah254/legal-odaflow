"use client"

import type {
  Meeting,
  MeetingTranscript,
  MeetingNotes,
  MeetingEvent,
  MeetingTranscriptSegment,
  MeetingActionItem,
} from "@/lib/types/meetings"
import { getClientById } from "@/lib/mock/clients"
import { getMatterById } from "@/lib/mock/matters"

const STORAGE_KEY_MEETINGS = "odaflow_meetings"
const STORAGE_KEY_TRANSCRIPTS = "odaflow_meeting_transcripts"
const STORAGE_KEY_NOTES = "odaflow_meeting_notes"
const STORAGE_KEY_EVENTS = "odaflow_meeting_events"

const TENANT_ID = "tenant-1"

function loadMeetings(): Meeting[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETINGS)
    if (!raw) return []
    const data = JSON.parse(raw) as Meeting[]
    return data.map((m) => ({
      ...m,
      startAt: new Date(m.startAt),
      endAt: m.endAt ? new Date(m.endAt) : undefined,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
    }))
  } catch {
    return []
  }
}

function saveMeetings(meetings: Meeting[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings))
}

function loadTranscripts(): MeetingTranscript[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSCRIPTS)
    if (!raw) return []
    const data = JSON.parse(raw) as MeetingTranscript[]
    return data.map((t) => ({
      ...t,
      createdAt: new Date(t.createdAt),
    }))
  } catch {
    return []
  }
}

function saveTranscripts(transcripts: MeetingTranscript[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_TRANSCRIPTS, JSON.stringify(transcripts))
}

function loadNotes(): MeetingNotes[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTES)
    if (!raw) return []
    const data = JSON.parse(raw) as MeetingNotes[]
    return data.map((n) => ({
      ...n,
      actionItems: (n.actionItems || []).map((a) => ({
        ...a,
        dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
      })),
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    }))
  } catch {
    return []
  }
}

function saveNotes(notes: MeetingNotes[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes))
}

function loadEvents(): MeetingEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS)
    if (!raw) return []
    const data = JSON.parse(raw) as MeetingEvent[]
    return data.map((e) => ({ ...e, createdAt: new Date(e.createdAt) }))
  } catch {
    return []
  }
}

function saveEvents(events: MeetingEvent[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events))
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Generate deterministic mock transcript segments for a meeting */
function generateMockTranscript(meetingId: string, durationMs: number): MeetingTranscript {
  const segments: MeetingTranscriptSegment[] = []
  const sampleLines = [
    { speaker: "Speaker 1 (Lawyer)", text: "Thank you for joining. Let's go through the key points we discussed last week." },
    { speaker: "Speaker 2 (Client)", text: "Yes, we've reviewed the draft and have a few comments on section three." },
    { speaker: "Speaker 1 (Lawyer)", text: "Understood. I've noted the amendments. We'll have the revised version by Friday." },
    { speaker: "Speaker 2 (Client)", text: "That works. We also need to discuss the timeline for the next phase." },
    { speaker: "Speaker 1 (Lawyer)", text: "I'll send a proposed schedule by end of day. Any other action items?" },
    { speaker: "Speaker 2 (Client)", text: "Nothing from our side. We'll confirm once we have internal sign-off." },
    { speaker: "Speaker 1 (Lawyer)", text: "Perfect. I'll follow up with the summary and next steps in writing." },
  ]
  const chunkMs = Math.max(15000, Math.floor(durationMs / sampleLines.length))
  sampleLines.forEach((line, i) => {
    segments.push({
      startMs: i * chunkMs,
      endMs: (i + 1) * chunkMs,
      speakerId: `s${(i % 2) + 1}`,
      speakerLabel: line.speaker,
      text: line.text,
      confidence: 0.95,
    })
  })
  return {
    id: generateId("tr"),
    meetingId,
    version: 1,
    language: "en",
    diarizationEnabled: true,
    segments,
    rawText: segments.map((s) => s.text).join(" "),
    createdAt: new Date(),
  }
}

/** Generate deterministic mock notes for a meeting */
function generateMockNotes(meetingId: string, title: string, participants: string[]): MeetingNotes {
  const now = new Date()
  const actionItems: MeetingActionItem[] = [
    { text: "Revise section three per client comments", ownerUserId: undefined, dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), status: "pending" },
    { text: "Send proposed timeline for next phase", ownerUserId: undefined, dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), status: "pending" },
    { text: "Email summary and next steps to client", ownerUserId: undefined, dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), status: "pending" },
  ]
  return {
    id: generateId("notes"),
    meetingId,
    version: 1,
    title,
    attendees: participants,
    agenda: ["Review draft", "Section three amendments", "Timeline for next phase"],
    summaryBullets: [
      "Client reviewed draft and provided comments on section three.",
      "Revised version to be delivered by Friday.",
      "Proposed schedule for next phase to be sent by EOD.",
      "Client will confirm after internal sign-off.",
    ],
    decisions: ["Proceed with amendments to section three", "Target Friday for revised draft"],
    actionItems,
    risks: [],
    openQuestions: ["Exact date for internal sign-off from client"],
    followUpEmailDraft: "Dear [Client], Please find below a brief summary of our call and next steps…",
    createdAt: now,
    updatedAt: now,
  }
}

export function getMeetingsByClient(clientId: string): Meeting[] {
  const meetings = loadMeetings()
  return meetings.filter((m) => m.clientId === clientId).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
}

export function getMeetingsByMatter(matterId: string): Meeting[] {
  const meetings = loadMeetings()
  return meetings.filter((m) => m.matterId === matterId).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
}

export function getMeetingById(id: string): Meeting | undefined {
  return loadMeetings().find((m) => m.id === id)
}

export function getTranscriptByMeetingId(meetingId: string): MeetingTranscript | undefined {
  return loadTranscripts().find((t) => t.meetingId === meetingId)
}

export function getNotesByMeetingId(meetingId: string): MeetingNotes | undefined {
  return loadNotes().find((n) => n.meetingId === meetingId)
}

export function getEventsByMeetingId(meetingId: string): MeetingEvent[] {
  return loadEvents()
    .filter((e) => e.meetingId === meetingId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function createMeeting(params: {
  clientId: string
  matterId?: string
  title: string
  description?: string
  participants: string[]
  confidentiality: "standard" | "restricted" | "highly_restricted"
  createdByUserId: string
  source: "manual_recording" | "upload" | "zoom" | "google_meet" | "teams"
}): Meeting {
  const meetings = loadMeetings()
  const now = new Date()
  const meeting: Meeting = {
    id: generateId("mt"),
    tenantId: TENANT_ID,
    clientId: params.clientId,
    matterId: params.matterId,
    title: params.title,
    description: params.description,
    startAt: now,
    createdByUserId: params.createdByUserId,
    participants: params.participants,
    source: params.source,
    confidentiality: params.confidentiality,
    visibilityAllowListUserIds: [],
    status: params.source === "manual_recording" ? "recording" : "uploaded",
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
  meetings.push(meeting)
  saveMeetings(meetings)
  addMeetingEvent(meeting.id, "meeting_created", {}, params.createdByUserId)
  return meeting
}

export function addMeetingEvent(
  meetingId: string,
  eventType: string,
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const events = loadEvents()
  events.push({
    id: generateId("ev"),
    meetingId,
    eventType,
    payload,
    actorUserId,
    createdAt: new Date(),
  })
  saveEvents(events)
}

export function updateMeetingStatus(
  meetingId: string,
  status: Meeting["status"],
  updates?: Partial<Pick<Meeting, "endAt" | "durationMs" | "audioAssetId">>
) {
  const meetings = loadMeetings()
  const idx = meetings.findIndex((m) => m.id === meetingId)
  if (idx === -1) return
  const prev = meetings[idx]
  meetings[idx] = {
    ...prev,
    status,
    ...updates,
    updatedAt: new Date(),
  }
  if (status === "ready" && updates?.durationMs != null) {
    const transcript = generateMockTranscript(meetingId, updates.durationMs)
    const notes = generateMockNotes(meetingId, prev.title, prev.participants)
    const transcripts = loadTranscripts()
    transcripts.push(transcript)
    saveTranscripts(transcripts)
    const notesList = loadNotes()
    notesList.push(notes)
    saveNotes(notesList)
  }
  saveMeetings(meetings)
}

export function finishRecordingAndProcess(meetingId: string, durationMs: number, userId: string): void {
  updateMeetingStatus(meetingId, "uploaded", { endAt: new Date(), durationMs })
  addMeetingEvent(meetingId, "recording_stopped", { durationMs }, userId)
  // Simulate processing delay then set ready
  updateMeetingStatus(meetingId, "processing")
  setTimeout(() => {
    updateMeetingStatus(meetingId, "ready", { durationMs })
    addMeetingEvent(meetingId, "transcript_ready", {}, userId)
  }, 2500)
}

export function searchMeetings(query: string, filters?: { clientId?: string; matterId?: string }): Meeting[] {
  const meetings = loadMeetings()
  let list = meetings
  if (filters?.clientId) list = list.filter((m) => m.clientId === filters.clientId)
  if (filters?.matterId) list = list.filter((m) => m.matterId === filters.matterId)
  if (!query.trim()) return list.sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
  const q = query.toLowerCase()
  const client = getClientById(filters?.clientId || "")
  const clientName = client?.name.toLowerCase() || ""
  return list.filter((m) => {
    const title = m.title.toLowerCase()
    const clientNameForM = getClientById(m.clientId)?.name.toLowerCase() || ""
    return title.includes(q) || clientNameForM.includes(q) || (filters?.clientId && clientName.includes(q))
  }).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
}

export function getAllMeetings(): Meeting[] {
  return loadMeetings().sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
}
