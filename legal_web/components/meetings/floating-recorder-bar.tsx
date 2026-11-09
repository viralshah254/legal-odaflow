"use client"

// Web Speech API types — not yet fully standardized in lib.dom.d.ts
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}
interface ISpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): { readonly transcript: string; readonly confidence: number }
  [index: number]: { readonly transcript: string; readonly confidence: number }
}
interface ISpeechRecognitionResultList {
  readonly length: number
  item(index: number): ISpeechRecognitionResult
  [index: number]: ISpeechRecognitionResult
}
interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: ISpeechRecognitionResultList
}
interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import type { Meeting } from "@/lib/types/meetings"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useMeetingRecordingStore } from "@/lib/store/meeting-recording-store"
import {
  createMeetingMediaRecorder,
  getMeetingMediaStream,
  isLiveMediaStream,
  mediaCaptureErrorMessage,
  stopMediaStream,
} from "@/lib/meetings/media-capture"
import {
  ChunkedRecordingUpload,
  RECORDER_TIMESLICE_MS,
  syncRecordingDuration,
  uploadMeetingAudioWithProgress,
} from "@/lib/meetings/chunked-recording-upload"
import {
  formatMediaDuration,
  formatRecordingClock,
  formatRecordingDurationLive,
} from "@/lib/meetings/format-duration"
import { startPcmCapture } from "@/lib/meetings/stream-audio-capture"
import { getRealtimeSocketUrl } from "@/lib/api/api-base"
import { resolveAccessToken } from "@/lib/api/client"
import { Square, Pause, Play, ChevronUp, ChevronDown, Loader2, X, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

function formatTime(ms: number) {
  return formatRecordingClock(ms)
}

interface FloatingRecorderBarProps {
  meeting: Meeting
  onClose: () => void
  includeVideo?: boolean
  /** Keep recording logic mounted but hide the bottom bar (e.g. on the meeting page). */
  hideUI?: boolean
}

// Waveform bar heights (relative units, 1–8)
const WAVE_HEIGHTS = [3, 6, 4, 7, 5, 8, 4, 6, 3, 5]

export function FloatingRecorderBar({
  meeting,
  onClose,
  includeVideo = false,
  hideUI = false,
}: FloatingRecorderBarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenant()
  const registerControls = useMeetingRecordingStore((s) => s.registerControls)
  const setPendingMediaStream = useMeetingRecordingStore((s) => s.setPendingMediaStream)
  const setLiveTranscript = useMeetingRecordingStore((s) => s.setLiveTranscript)
  const setLiveInterimTranscript = useMeetingRecordingStore((s) => s.setLiveInterimTranscript)
  const addLiveTranscriptSegment = useMeetingRecordingStore((s) => s.addLiveTranscriptSegment)
  const setTranscriptionSource = useMeetingRecordingStore((s) => s.setTranscriptionSource)

  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPartsUploaded, setUploadPartsUploaded] = useState(0)
  const [bytesBuffered, setBytesBuffered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [captionsOpen, setCaptionsOpen] = useState(true)
  const [finalTranscript, setFinalTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [micReady, setMicReady] = useState(false)
  const [needsMicEnable, setNeedsMicEnable] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [requestingMic, setRequestingMic] = useState(false)
  const [hasSpeechApi, setHasSpeechApi] = useState(false)
  const [captionsListening, setCaptionsListening] = useState(false)
  const [captionsUnavailable, setCaptionsUnavailable] = useState(false)
  const [captionsHint, setCaptionsHint] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)
  const chunkUploaderRef = useRef<ChunkedRecordingUpload | null>(null)
  const lastDurationSyncRef = useRef(0)
  const speechRef = useRef<ISpeechRecognition | null>(null)
  const finalTranscriptRef = useRef("")
  const stoppedRef = useRef(false)
  const requestingMicRef = useRef(false)
  const bootstrapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captionsRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const routerRef = useRef(router)
  const micReadyRef = useRef(false)
  const isPausedRef = useRef(false)
  const startSpeechRecognitionRef = useRef<() => boolean>(() => false)
  // Deepgram streaming refs
  const deepgramSocketRef = useRef<Socket | null>(null)
  const pcmCaptureStopRef = useRef<(() => void) | null>(null)
  const deepgramActiveRef = useRef(false)
  const deepgramFinalTextRef = useRef("")
  const [deepgramConnected, setDeepgramConnected] = useState(false)

  useEffect(() => {
    micReadyRef.current = micReady
  }, [micReady])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const stopSpeechRecognition = useCallback(() => {
    if (speechRef.current) {
      try { speechRef.current.abort() } catch {}
      speechRef.current = null
    }
    setCaptionsListening(false)
  }, [])

  // ── Deepgram streaming transcription ─────────────────────────────────────

  const stopDeepgramStreaming = useCallback(() => {
    deepgramActiveRef.current = false
    if (pcmCaptureStopRef.current) {
      pcmCaptureStopRef.current()
      pcmCaptureStopRef.current = null
    }
    const socket = deepgramSocketRef.current
    if (socket) {
      socket.emit("meeting-transcribe:stop", { meetingId: meeting.id })
      deepgramSocketRef.current = null
      socket.disconnect()
    }
    setDeepgramConnected(false)
  }, [meeting.id])

  const startDeepgramStreaming = useCallback(
    async (stream: MediaStream) => {
      if (deepgramActiveRef.current) return
      if (!activeTenantId) return

      const token = await resolveAccessToken()
      if (!token) return

      const socket = io(`${getRealtimeSocketUrl()}/realtime`, {
        transports: ["websocket", "polling"],
        auth: { token, tenantId: activeTenantId },
      })
      deepgramSocketRef.current = socket

      socket.once("meeting-transcribe:started", () => {
        deepgramActiveRef.current = true
        setDeepgramConnected(true)
        setTranscriptionSource("deepgram")
        setCaptionsHint(null)

        // Start PCM capture and forward to Deepgram via socket
        const stopCapture = startPcmCapture(stream, (pcmBuffer) => {
          if (!deepgramActiveRef.current) return
          socket.emit("meeting-transcribe:audio", {
            meetingId: meeting.id,
            chunk: Buffer.from(pcmBuffer).toString("base64"),
          })
        })
        pcmCaptureStopRef.current = stopCapture
        setCaptionsListening(true)
      })

      socket.once("meeting-transcribe:unavailable", () => {
        // Deepgram not configured on backend — fall back to Web Speech
        deepgramSocketRef.current = null
        socket.disconnect()
        setTranscriptionSource("web-speech")
        startSpeechRecognitionRef.current()
      })

      socket.on("meeting-transcribe:result", (data: {
        meetingId: string
        text: string
        startMs: number
        endMs: number
        isFinal: boolean
      }) => {
        if (!data.text) return
        if (data.isFinal) {
          deepgramFinalTextRef.current = (deepgramFinalTextRef.current + " " + data.text).trim()
          finalTranscriptRef.current = deepgramFinalTextRef.current
          setFinalTranscript(deepgramFinalTextRef.current)
          setLiveTranscript(deepgramFinalTextRef.current)
          addLiveTranscriptSegment({ text: data.text, startMs: data.startMs, endMs: data.endMs })
          setLiveInterimTranscript("")
          setInterimTranscript("")
        } else {
          setInterimTranscript(data.text)
          setLiveInterimTranscript(data.text)
        }
      })

      socket.on("meeting-transcribe:error", (data: { message: string }) => {
        // Non-fatal: show hint but keep audio recording
        setCaptionsHint(data.message ?? "Live captions paused. Audio is still recording.")
      })

      socket.on("connect_error", () => {
        if (!deepgramActiveRef.current) {
          // Failed to connect before Deepgram started — fall back to Web Speech
          deepgramSocketRef.current = null
          setTranscriptionSource("web-speech")
          startSpeechRecognitionRef.current()
        }
      })

      const startTranscription = () => {
        socket.emit("meeting-transcribe:start", { meetingId: meeting.id })
      }

      // Wait for server auth (handshake middleware) before starting STT.
      if (socket.connected) {
        startTranscription()
      } else {
        socket.once("connected", startTranscription)
      }
    },
    [
      activeTenantId,
      meeting.id,
      addLiveTranscriptSegment,
      setLiveTranscript,
      setLiveInterimTranscript,
      setTranscriptionSource,
    ],
  )

  // ── End Deepgram ──────────────────────────────────────────────────────────

  const startSpeechRecognition = useCallback(() => {
    const SR: SpeechRecognitionConstructor | undefined =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined

    if (!SR) {
      setHasSpeechApi(false)
      setCaptionsUnavailable(true)
      setCaptionsHint(
        "Live captions aren't supported in this browser. Audio is still recording — A transcript will be prepared after you stop.",
      )
      return false
    }

    setHasSpeechApi(true)
    setCaptionsUnavailable(false)
    stoppedRef.current = false

    if (speechRef.current) {
      try { speechRef.current.abort() } catch {}
      speechRef.current = null
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"
    recognition.maxAlternatives = 1

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) {
          finalTranscriptRef.current += res[0].transcript + " "
          setFinalTranscript(finalTranscriptRef.current)
          setLiveTranscript(finalTranscriptRef.current)
        } else {
          interim += res[0].transcript
        }
      }
      setInterimTranscript(interim)
      setLiveInterimTranscript(interim)
    }

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      setCaptionsListening(false)
      if (event.error === "network") {
        setCaptionsHint(
          "Live captions need an internet connection (Chrome sends audio to Google for speech-to-text). Your recording is still being saved.",
        )
      } else if (event.error === "not-allowed") {
        setCaptionsHint("Speech recognition was blocked. Audio is still recording.")
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setCaptionsHint(`Live captions paused (${event.error}). Audio is still recording.`)
      }
    }

    recognition.onstart = () => {
      setCaptionsListening(true)
      setCaptionsHint(null)
    }

    recognition.onend = () => {
      setCaptionsListening(false)
      if (!stoppedRef.current && micReadyRef.current && !isPausedRef.current) {
        window.setTimeout(() => {
          if (!stoppedRef.current && micReadyRef.current && !speechRef.current) {
            startSpeechRecognitionRef.current()
          }
        }, 250)
      }
    }

    try {
      recognition.start()
      speechRef.current = recognition
      return true
    } catch {
      setCaptionsHint("Could not start live captions. Audio is still recording.")
      return false
    }
  }, [setLiveInterimTranscript, setLiveTranscript])

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition
  }, [startSpeechRecognition])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    routerRef.current = router
  }, [router])

  const clearBootstrapTimeout = useCallback(() => {
    if (bootstrapTimeoutRef.current) {
      clearTimeout(bootstrapTimeoutRef.current)
      bootstrapTimeoutRef.current = null
    }
  }, [])

  const attachStream = useCallback(
    async (stream: MediaStream) => {
      if (!isLiveMediaStream(stream)) {
        throw new DOMException("Microphone is no longer active.", "InvalidStateError")
      }

      if (includeVideo && videoRef.current) {
        videoRef.current.srcObject = stream
        // Do not await play() — it can hang indefinitely without blocking capture.
        void videoRef.current.play().catch(() => {})
      }
      streamRef.current = stream
      chunksRef.current = []

      const recorder = createMeetingMediaRecorder(stream, includeVideo)
      const mimeType = recorder.mimeType || (includeVideo ? "video/webm" : "audio/webm")

      if (activeTenantId) {
        chunkUploaderRef.current = new ChunkedRecordingUpload(
          activeTenantId,
          meeting.id,
          mimeType,
          (progress) => {
            setUploadProgress(progress.percent)
            setUploadPartsUploaded(progress.partsUploaded)
            setBytesBuffered(progress.bytesTotal)
          },
        )
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          chunkUploaderRef.current?.absorbSlice(e.data)
          setBytesBuffered((prev) => prev + e.data.size)
        }
      }
      recorder.start(RECORDER_TIMESLICE_MS)
      recorderRef.current = recorder
      stoppedRef.current = false
      setMicReady(true)
      setNeedsMicEnable(false)
      setError(null)
    },
    [activeTenantId, includeVideo, meeting.id],
  )

  const syncRecorderReadyState = useCallback(() => {
    const recorder = recorderRef.current
    const active =
      isLiveMediaStream(streamRef.current) &&
      recorder != null &&
      recorder.state !== "inactive"
    setMicReady(active)
    setNeedsMicEnable(!active)
    setBootstrapping(false)
    return active
  }, [])

  const beginCapture = useCallback(
    async (stream: MediaStream) => {
      await attachStream(stream)
      // Try Deepgram first; it falls back to Web Speech internally if unavailable
      await startDeepgramStreaming(stream)
    },
    [attachStream, startDeepgramStreaming],
  )

  const requestMicrophone = useCallback(async () => {
    if (requestingMicRef.current) return
    if (isLiveMediaStream(streamRef.current) && recorderRef.current?.state !== "inactive") {
      syncRecorderReadyState()
      if (!speechRef.current) startSpeechRecognition()
      return
    }

    requestingMicRef.current = true
    clearBootstrapTimeout()
    setRequestingMic(true)
    setBootstrapping(true)
    setError(null)

    stopMediaStream(streamRef.current)
    streamRef.current = null
    recorderRef.current = null

    try {
      const stream = await getMeetingMediaStream(includeVideo)
      setPendingMediaStream(stream)
      await beginCapture(stream)
    } catch (e) {
      stopMediaStream(streamRef.current)
      streamRef.current = null
      recorderRef.current = null
      setPendingMediaStream(null)
      setError(mediaCaptureErrorMessage(includeVideo, e))
      setNeedsMicEnable(true)
      setMicReady(false)
    } finally {
      requestingMicRef.current = false
      setRequestingMic(false)
      setBootstrapping(false)
    }
  }, [beginCapture, clearBootstrapTimeout, includeVideo, setPendingMediaStream, startSpeechRecognition, syncRecorderReadyState])

  // Elapsed timer — 1 s ticks while mic is live; sync duration to API periodically
  useEffect(() => {
    if (uploading || !micReady) return
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setElapsedMs((prev) => {
          durationRef.current = prev + 1000
          return prev + 1000
        })
      }
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, uploading, micReady])

  useEffect(() => {
    if (!activeTenantId || !micReady || uploading || isPaused) return
    if (elapsedMs - lastDurationSyncRef.current < 10_000) return
    lastDurationSyncRef.current = elapsedMs
    void syncRecordingDuration(activeTenantId, meeting.id, elapsedMs)
  }, [activeTenantId, meeting.id, elapsedMs, micReady, uploading, isPaused])

  // Auto-scroll captions to bottom as new text arrives
  useEffect(() => {
    if (captionsRef.current) {
      captionsRef.current.scrollTop = captionsRef.current.scrollHeight
    }
  }, [finalTranscript, interimTranscript])

  const stopRecording = useCallback(async () => {
    if (uploading) return
    // Recover from a stale stopped flag left by effect cleanup (e.g. React Strict Mode remount).
    if (stoppedRef.current) {
      const live = recorderRef.current
      if (!live || live.state === "inactive") {
        setError("Recording session ended. Refresh the page and start again.")
        return
      }
      stoppedRef.current = false
    }
    stoppedRef.current = true

    if (timerRef.current) clearInterval(timerRef.current)

    // Stop speech recognition and Deepgram streaming
    stopSpeechRecognition()
    stopDeepgramStreaming()

    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") {
      setError("Microphone capture is not running. Allow the microphone and try again.")
      setNeedsMicEnable(true)
      stoppedRef.current = false
      return
    }

    // Wait for the final ondataavailable + onstop
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      if (recorder.state !== "inactive") recorder.stop()
    })

    const mimeType = recorder.mimeType || (includeVideo ? "video/webm" : "audio/webm")
    const blob = new Blob(chunksRef.current, { type: mimeType })

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    if (!activeTenantId) {
      setError("Session expired. Sign in again and retry.")
      stoppedRef.current = false
      return
    }

    if (blob.size === 0) {
      setError("No audio captured. Check microphone permissions and try again.")
      stoppedRef.current = false
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)
    try {
      const baseTranscript = finalTranscriptRef.current.trim()
      const notes = useMeetingRecordingStore.getState().quickNotes.trim()
      const draft =
        baseTranscript || notes
          ? [baseTranscript, notes ? `\n\n---\nQuick notes:\n${notes}` : ""].filter(Boolean).join("")
          : undefined

      const uploader = chunkUploaderRef.current
      if (uploader) {
        await uploader.finalize(durationRef.current, draft)
        setUploadProgress(100)
      } else {
        await uploadMeetingAudioWithProgress(
          activeTenantId,
          meeting.id,
          blob,
          durationRef.current,
          draft,
          setUploadProgress,
        )
      }
      await queryClient.invalidateQueries({ queryKey: ["meeting", activeTenantId, meeting.id] })
      await queryClient.invalidateQueries({ queryKey: ["meeting-transcript", activeTenantId, meeting.id] })
      await queryClient.invalidateQueries({ queryKey: ["meetings"] })
      onCloseRef.current()
      routerRef.current.push(`/app/meetings/${meeting.id}`)
    } catch (e) {
      // Fallback: single-file upload if chunked pipeline failed mid-flight
      try {
        const baseTranscript = finalTranscriptRef.current.trim()
        const notes = useMeetingRecordingStore.getState().quickNotes.trim()
        const draft =
          baseTranscript || notes
            ? [baseTranscript, notes ? `\n\n---\nQuick notes:\n${notes}` : ""].filter(Boolean).join("")
            : undefined
        await uploadMeetingAudioWithProgress(
          activeTenantId,
          meeting.id,
          blob,
          durationRef.current,
          draft,
          setUploadProgress,
        )
        await queryClient.invalidateQueries({ queryKey: ["meeting", activeTenantId, meeting.id] })
        await queryClient.invalidateQueries({ queryKey: ["meeting-transcript", activeTenantId, meeting.id] })
        await queryClient.invalidateQueries({ queryKey: ["meetings"] })
        onCloseRef.current()
        routerRef.current.push(`/app/meetings/${meeting.id}`)
        return
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error ? fallbackErr.message : e instanceof Error ? e.message : "Upload failed",
        )
      }
      setUploading(false)
      stoppedRef.current = false
    }
  }, [meeting.id, activeTenantId, includeVideo, queryClient, uploading])

  const togglePause = useCallback(() => {
    if (!recorderRef.current) return
    if (isPaused) {
      if (recorderRef.current.state === "paused") recorderRef.current.resume()
      // Resume captions — Deepgram stream stays open; Web Speech needs restart
      if (!deepgramActiveRef.current) startSpeechRecognition()
      setIsPaused(false)
    } else {
      if (recorderRef.current.state === "recording") recorderRef.current.pause()
      if (!deepgramActiveRef.current) stopSpeechRecognition()
      setIsPaused(true)
    }
  }, [isPaused, startSpeechRecognition, stopSpeechRecognition])

  // Start from pre-acquired stream (Start recording click) or prompt user to allow mic.
  useEffect(() => {
    let mounted = true

    const resumeExistingCapture = () => {
      if (!syncRecorderReadyState()) return false
      if (!speechRef.current) startSpeechRecognition()
      return true
    }

    if (resumeExistingCapture()) {
      return () => {
        mounted = false
      }
    }

    stoppedRef.current = false
    chunksRef.current = []
    finalTranscriptRef.current = ""
    setMicReady(false)
    setNeedsMicEnable(true)
    setBootstrapping(true)
    setError(null)
    setLiveTranscript("")
    setLiveInterimTranscript("")

    const pendingStream = useMeetingRecordingStore.getState().pendingMediaStream
    const shouldWatchPendingAttach = Boolean(pendingStream)

    const bootstrap = async () => {
      if (resumeExistingCapture()) return

      if (pendingStream) {
        if (!isLiveMediaStream(pendingStream)) {
          if (mounted) {
            setPendingMediaStream(null)
            setError("Microphone session expired. Click Allow mic to start again.")
            setNeedsMicEnable(true)
            setBootstrapping(false)
          }
          return
        }

        try {
          await beginCapture(pendingStream)
          if (mounted) {
            setBootstrapping(false)
            clearBootstrapTimeout()
          }
        } catch (e) {
          if (mounted) {
            setPendingMediaStream(null)
            setError(mediaCaptureErrorMessage(includeVideo, e))
            setNeedsMicEnable(true)
            setBootstrapping(false)
          }
        }
        return
      }

      if (mounted) {
        setNeedsMicEnable(true)
        setBootstrapping(false)
      }
    }

    void bootstrap()

    if (shouldWatchPendingAttach) {
      clearBootstrapTimeout()
      bootstrapTimeoutRef.current = setTimeout(() => {
        if (!mounted) return
        const recorder = recorderRef.current
        const stillStarting =
          !recorder || recorder.state === "inactive" || !isLiveMediaStream(streamRef.current)
        if (stillStarting) {
          setBootstrapping(false)
          setNeedsMicEnable(true)
          setError((prev) => prev ?? "Could not attach the microphone. Click Allow mic to try again.")
        }
      }, 12_000)
    }

    return () => {
      mounted = false
      clearBootstrapTimeout()
      // Do not abort speech or set stoppedRef here — React remounts would kill live captions.
    }
  }, [meeting.id, beginCapture, clearBootstrapTimeout, includeVideo, setPendingMediaStream, startSpeechRecognition, syncRecorderReadyState])

  useEffect(() => {
    return () => {
      stoppedRef.current = true
      stopSpeechRecognition()
      // Clean up Deepgram without persisting (component unmount, not intentional stop)
      if (pcmCaptureStopRef.current) {
        pcmCaptureStopRef.current()
        pcmCaptureStopRef.current = null
      }
      if (deepgramSocketRef.current) {
        deepgramSocketRef.current.disconnect()
        deepgramSocketRef.current = null
      }
    }
  }, [stopSpeechRecognition])

  // Ensure Web Speech captions start when not using Deepgram.
  useEffect(() => {
    if (!micReady || isPaused || uploading || bootstrapping || captionsUnavailable) return
    if (deepgramActiveRef.current) return
    if (speechRef.current) return
    startSpeechRecognition()
  }, [micReady, isPaused, uploading, bootstrapping, captionsUnavailable, startSpeechRecognition])

  // Expose controls to meeting detail page (inline Stop & save)
  useEffect(() => {
    registerControls({
      stopRecording,
      togglePause,
      requestMicrophone,
      isPaused,
      uploading,
      bootstrapping,
      requestingMic,
      captionsListening: deepgramConnected || captionsListening,
      captionsUnavailable,
      captionsHint,
      elapsedMs,
      elapsedLabel: formatMediaDuration(elapsedMs, { compact: true }),
      elapsedDisplay: formatRecordingDurationLive(elapsedMs),
      uploadProgress,
      uploadPartsUploaded,
      bytesBuffered,
      micReady,
      needsMicEnable,
      error,
      transcriptionSource: deepgramConnected ? "deepgram" : captionsListening ? "web-speech" : "none",
    })
  }, [
    registerControls,
    stopRecording,
    togglePause,
    requestMicrophone,
    isPaused,
    uploading,
    bootstrapping,
    requestingMic,
    captionsListening,
    captionsUnavailable,
    captionsHint,
    elapsedMs,
    uploadProgress,
    uploadPartsUploaded,
    bytesBuffered,
    micReady,
    needsMicEnable,
    error,
    deepgramConnected,
  ])

  useEffect(() => {
    return () => registerControls(null)
  }, [registerControls])

  const hasContent = finalTranscript.trim() || interimTranscript.trim()
  const showMicPrompt = !micReady && !uploading && !bootstrapping

  // Headless mode: keep media capture running but let the meeting page own the UI.
  if (hideUI) {
    return includeVideo ? (
      <video ref={videoRef} autoPlay muted playsInline className="sr-only" aria-hidden />
    ) : null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] select-none pointer-events-auto">
      {includeVideo && micReady && (
        <div className="px-4 mb-1 flex justify-end">
          <div className="overflow-hidden rounded-xl border border-border bg-black shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-28 w-40 object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
        </div>
      )}
      {/* Live captions panel — slides up above the bar */}
      {captionsOpen && hasContent && (
        <div className="px-4 mb-1">
          <div
            ref={captionsRef}
            className="bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-4 max-h-44 overflow-y-auto"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-semibold">
              Live transcript
            </p>
            <p className="text-sm leading-relaxed">
              <span>{finalTranscript}</span>
              {interimTranscript && (
                <span className="text-muted-foreground/60 italic">{interimTranscript}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="bg-background/95 backdrop-blur-md border-t border-border shadow-2xl">
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center gap-3">

          {/* Status dot */}
          <div className="shrink-0">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span
                className={cn(
                  "block h-3 w-3 rounded-full bg-red-500",
                  !isPaused && "animate-pulse",
                )}
              />
            )}
          </div>

          {/* Meeting info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight">{meeting.title}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {uploading
                ? uploadProgress > 0
                  ? `Uploading… ${uploadProgress}%${uploadPartsUploaded > 0 ? ` · ${uploadPartsUploaded} part${uploadPartsUploaded === 1 ? "" : "s"} in cloud` : ""}`
                  : "Uploading…"
                : bootstrapping
                  ? "Starting…"
                  : showMicPrompt
                    ? "Allow microphone to start"
                    : isPaused
                      ? `Paused · ${formatRecordingDurationLive(elapsedMs)}`
                      : formatRecordingDurationLive(elapsedMs)}
            </p>
            {!uploading && micReady && bytesBuffered > 0 && (
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                {(bytesBuffered / (1024 * 1024)).toFixed(1)} MB captured · uploading in chunks while you record
              </p>
            )}
          </div>

          {/* Animated waveform (hidden on small screens) */}
          {!isPaused && !uploading && micReady && (
            <div className="hidden sm:flex items-end gap-[3px] h-6 shrink-0" aria-hidden>
              {WAVE_HEIGHTS.map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-primary/70"
                  style={{
                    height: `${h * 3}px`,
                    animation: `recorderWave 0.9s ease-in-out ${i * 0.08}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Live captions toggle (only when SR available) */}
          {hasSpeechApi && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex shrink-0 h-7 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => setCaptionsOpen((v) => !v)}
              disabled={uploading}
              aria-label={captionsOpen ? "Hide live captions" : "Show live captions"}
            >
              {captionsOpen ? (
                <><ChevronDown className="h-3 w-3" /> Hide captions</>
              ) : (
                <><ChevronUp className="h-3 w-3" /> Live captions</>
              )}
            </Button>
          )}

          {/* Error */}
          {error && (
            <p className="hidden sm:block text-xs text-destructive shrink-0 max-w-[min(100%,280px)] whitespace-normal">
              {error}
            </p>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {bootstrapping && !micReady && !uploading ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </Button>
            ) : showMicPrompt ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold"
                  onClick={() => void requestMicrophone()}
                  disabled={requestingMic}
                >
                  {requestingMic ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  {requestingMic ? "Requesting…" : "Allow microphone"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={onClose}
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>
              </>
            ) : error && !micReady && !uploading ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => void requestMicrophone()}
                  disabled={requestingMic}
                >
                  Retry mic
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={onClose}
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>
              </>
            ) : (
              <>
                {!uploading && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={togglePause}
                    disabled={!micReady || uploading}
                    aria-label={isPaused ? "Resume recording" : "Pause recording"}
                  >
                    {isPaused
                      ? <Play className="h-3.5 w-3.5" />
                      : <Pause className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold"
                  onClick={() => void stopRecording()}
                  disabled={uploading || !micReady}
                >
                  <Square className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Stop & save"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile error */}
        {error && (
          <p className="sm:hidden text-xs text-destructive px-4 pb-2">{error}</p>
        )}
      </div>
    </div>
  )
}
