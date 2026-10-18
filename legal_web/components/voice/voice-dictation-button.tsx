"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/api/api-base"

/**
 * Voice dictation button using the Web Speech API (browser-native),
 * with automatic Whisper fallback for browsers where Web Speech is weak
 * or unavailable (e.g. Firefox, some webviews).
 */

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionResultList = {
  [index: number]: SpeechRecognitionResult
  length: number
}

type SpeechRecognitionResult = {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

type SpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

type SpeechRecognitionErrorEvent = {
  error: string
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition as (new () => SpeechRecognitionInstance) | undefined) ??
    (w.webkitSpeechRecognition as (new () => SpeechRecognitionInstance) | undefined) ??
    null
}

/** Try to transcribe an audio blob using the backend Whisper endpoint. */
async function whisperTranscribe(blob: Blob, lang: string, token?: string): Promise<string | null> {
  try {
    const base = getApiBaseUrl()
    const form = new FormData()
    form.append("audio", blob, "recording.webm")
    form.append("lang", lang.split("-")[0])
    const res = await fetch(`${base}/ai/voice/transcribe`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) return null
    const json = await res.json() as { transcript?: string | null }
    return json.transcript ?? null
  } catch {
    return null
  }
}

interface VoiceDictationButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void
  /** BCP-47 language code. Defaults to 'en-IN' for India. */
  lang?: string
  className?: string
  size?: "sm" | "md" | "lg"
  title?: string
  /** Auth token for Whisper fallback endpoint. */
  token?: string
}

export function VoiceDictationButton({
  onTranscript,
  lang = "en-IN",
  className,
  size = "md",
  title = "Dictate",
  token,
}: VoiceDictationButtonProps) {
  const [listening, setListening] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"webspeech" | "whisper">("webspeech")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // MediaRecorder refs for Whisper fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const Rec = getSpeechRecognition()
    if (!Rec) {
      // No Web Speech: check if MediaRecorder is available for Whisper fallback
      if (typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined") {
        setMode("whisper")
      } else {
        setSupported(false)
      }
      return
    }

    setMode("webspeech")
    const rec = new Rec()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ""
      let final = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) final += transcript
        else interim += transcript
      }
      if (final) onTranscript(final, true)
      else if (interim) onTranscript(interim, false)
    }

    rec.onerror = (event) => {
      // If Web Speech fails (e.g. not-allowed, network), try Whisper
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMode("whisper")
      }
      setError(`Voice error: ${event.error}`)
      setListening(false)
    }

    rec.onend = () => {
      setListening(false)
    }

    recognitionRef.current = rec

    return () => {
      recognitionRef.current?.abort()
    }
  }, [lang, onTranscript])

  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setListening(false)
        setUploading(true)
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const transcript = await whisperTranscribe(blob, lang, token)
        setUploading(false)
        if (transcript) {
          onTranscript(transcript, true)
        } else {
          setError("Transcription unavailable. Please type your query.")
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setListening(true)
      setError(null)
    } catch (err) {
      setError("Microphone access denied.")
    }
  }, [lang, onTranscript, token])

  const stopWhisper = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    setError(null)

    if (mode === "whisper") {
      if (listening) {
        stopWhisper()
      } else {
        void startWhisper()
      }
      return
    }

    const rec = recognitionRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      try {
        rec.start()
        setListening(true)
      } catch {
        // Already started
      }
    }
  }, [listening, mode, startWhisper, stopWhisper])

  if (!supported) return null

  const sizeMap = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }
  const iconMap = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={uploading}
        title={listening ? "Stop dictating" : title}
        className={cn(
          "flex items-center justify-center rounded-full border transition-all duration-150",
          sizeMap[size],
          listening
            ? "border-red-400 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 animate-pulse"
            : uploading
              ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300",
          className,
        )}
      >
        {uploading ? (
          <Loader2 className={cn(iconMap[size], "animate-spin")} />
        ) : listening ? (
          <MicOff className={iconMap[size]} />
        ) : (
          <Mic className={iconMap[size]} />
        )}
      </button>
      {mode === "whisper" && !listening && !uploading && (
        <span className="text-[9px] text-indigo-500 absolute -bottom-4 whitespace-nowrap">Whisper</span>
      )}
      {error && (
        <span className="text-[10px] text-red-500 absolute -bottom-4 whitespace-nowrap">{error}</span>
      )}
    </div>
  )
}

/**
 * Inline voice dictation hook — returns interim transcript and controls.
 */
export function useVoiceDictation({
  lang = "en-IN",
  onFinalTranscript,
}: {
  lang?: string
  onFinalTranscript?: (text: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [supported] = useState(() => getSpeechRecognition() !== null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const Rec = getSpeechRecognition()
    if (!Rec) return
    const rec = new Rec()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interimText = ""
      let finalText = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) finalText += transcript
        else interimText += transcript
      }
      if (finalText) {
        onFinalTranscript?.(finalText)
        setInterim("")
      } else {
        setInterim(interimText)
      }
    }

    rec.onend = () => {
      setListening(false)
      setInterim("")
    }

    recognitionRef.current = rec
    return () => recognitionRef.current?.abort()
  }, [lang, onFinalTranscript])

  const start = useCallback(() => {
    recognitionRef.current?.start()
    setListening(true)
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, interim, supported, start, stop }
}
