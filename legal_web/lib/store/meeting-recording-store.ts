import { create } from "zustand"
import type { Meeting } from "@/lib/types/meetings"
import { isOrphanedRecording } from "@/lib/meetings/recording-utils"
import { stopMediaStream } from "@/lib/meetings/media-capture"

const SESSION_KEY = "activeMeeting"
const SESSION_VIDEO_KEY = "activeMeetingIncludeVideo"

export interface MeetingRecorderControls {
  stopRecording: () => void | Promise<void>
  togglePause: () => void
  requestMicrophone: () => void | Promise<void>
  isPaused: boolean
  uploading: boolean
  bootstrapping: boolean
  requestingMic: boolean
  captionsListening: boolean
  captionsUnavailable: boolean
  captionsHint: string | null
  elapsedMs: number
  /** Human-readable elapsed label, e.g. `2 min 14 sec` */
  elapsedLabel: string
  /** Combined clock + label, e.g. `2:14 · 2 min 14 sec` */
  elapsedDisplay: string
  uploadProgress: number
  uploadPartsUploaded: number
  bytesBuffered: number
  micReady: boolean
  needsMicEnable: boolean
  error: string | null
  /** Source of live captions */
  transcriptionSource: "deepgram" | "web-speech" | "none"
}

interface MeetingRecordingState {
  activeMeeting: Meeting | null
  includeVideo: boolean
  /** Stream acquired during the Start recording click — held until recording ends. */
  pendingMediaStream: MediaStream | null
  controls: MeetingRecorderControls | null
  /** Quick notes typed by the user during a live recording session. */
  quickNotes: string
  /** Live final transcript accumulated from speech recognition. */
  liveTranscript: string
  /** In-progress (interim) speech recognition result. */
  liveInterimTranscript: string
  /** Timestamped transcript segments from Deepgram streaming. */
  liveTranscriptSegments: Array<{ text: string; startMs: number; endMs: number }>
  /** Source of live captions — deepgram when Deepgram is active, web-speech as fallback. */
  transcriptionSource: "deepgram" | "web-speech" | "none"
  setActiveRecording: (
    meeting: Meeting,
    options?: { includeVideo?: boolean; mediaStream?: MediaStream },
  ) => void
  setPendingMediaStream: (stream: MediaStream | null) => void
  clearActiveRecording: () => void
  clearActiveRecordingIfMatching: (meetingId: string) => void
  registerControls: (controls: MeetingRecorderControls | null) => void
  setQuickNotes: (notes: string) => void
  setLiveTranscript: (text: string) => void
  setLiveInterimTranscript: (text: string) => void
  addLiveTranscriptSegment: (segment: { text: string; startMs: number; endMs: number }) => void
  setTranscriptionSource: (source: "deepgram" | "web-speech" | "none") => void
  hydrateFromSession: () => void
}

function persistSession(meeting: Meeting | null, includeVideo: boolean) {
  try {
    if (meeting) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(meeting))
      sessionStorage.setItem(SESSION_VIDEO_KEY, includeVideo ? "1" : "0")
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_VIDEO_KEY)
    }
  } catch {
    /* ignore */
  }
}

export const useMeetingRecordingStore = create<MeetingRecordingState>((set, get) => ({
  activeMeeting: null,
  includeVideo: false,
  pendingMediaStream: null,
  controls: null,
  quickNotes: "",
  liveTranscript: "",
  liveInterimTranscript: "",
  liveTranscriptSegments: [],
  transcriptionSource: "none",

  setActiveRecording: (meeting, options) => {
    const includeVideo = options?.includeVideo ?? get().includeVideo
    // Only replace the stream when explicitly passed; otherwise keep the live capture.
    const mediaStream =
      options?.mediaStream !== undefined ? options.mediaStream : get().pendingMediaStream
    const current = get().activeMeeting
    persistSession(meeting, includeVideo)
    if (current?.id === meeting.id) {
      set({
        activeMeeting: meeting,
        includeVideo,
        pendingMediaStream: mediaStream,
      })
      return
    }
    stopMediaStream(get().pendingMediaStream)
    set({
      activeMeeting: meeting,
      includeVideo,
      pendingMediaStream: mediaStream,
      controls: null,
    })
  },

  setPendingMediaStream: (stream) => set({ pendingMediaStream: stream }),

  clearActiveRecording: () => {
    stopMediaStream(get().pendingMediaStream)
    persistSession(null, false)
    set({
      activeMeeting: null,
      includeVideo: false,
      pendingMediaStream: null,
      controls: null,
      quickNotes: "",
      liveTranscript: "",
      liveInterimTranscript: "",
      liveTranscriptSegments: [],
      transcriptionSource: "none",
    })
  },

  clearActiveRecordingIfMatching: (meetingId) => {
    if (get().activeMeeting?.id === meetingId) {
      get().clearActiveRecording()
    }
  },

  registerControls: (controls) => set({ controls }),

  setQuickNotes: (notes) => set({ quickNotes: notes }),

  setLiveTranscript: (text) => set({ liveTranscript: text }),

  setLiveInterimTranscript: (text) => set({ liveInterimTranscript: text }),

  addLiveTranscriptSegment: (segment) =>
    set((s) => ({ liveTranscriptSegments: [...s.liveTranscriptSegments, segment] })),

  setTranscriptionSource: (source) => set({ transcriptionSource: source }),

  hydrateFromSession: () => {
    if (get().activeMeeting) return
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) return
      const meeting = JSON.parse(stored) as Meeting
      if (meeting.status !== "recording" || isOrphanedRecording(meeting)) {
        persistSession(null, false)
        return
      }
      const includeVideo = sessionStorage.getItem(SESSION_VIDEO_KEY) === "1"
      set({ activeMeeting: meeting, includeVideo })
    } catch {
      /* ignore */
    }
  },
}))
