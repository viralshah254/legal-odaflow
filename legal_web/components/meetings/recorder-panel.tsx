"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Meeting } from "@/lib/types/meetings"
import { uploadMeetingAudio } from "@/lib/api/meetings"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Mic, Square, Pause, Play } from "lucide-react"
import { cn } from "@/lib/utils"

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  }
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

interface RecorderPanelProps {
  meeting: Meeting
  onClose: () => void
  onNavigateToMeeting?: (meetingId: string) => void
}

export function RecorderPanel({ meeting, onClose, onNavigateToMeeting }: RecorderPanelProps) {
  const { activeTenantId } = useTenant()

  const [isRecording, setIsRecording] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)

  // Elapsed timer
  useEffect(() => {
    if (!isRecording || isPaused) return
    timerRef.current = setInterval(() => {
      setElapsedMs((prev) => {
        durationRef.current = prev + 500
        return prev + 500
      })
    }, 500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") {
      onClose()
      return
    }

    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: mimeType })

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      if (!activeTenantId || blob.size === 0) {
        onClose()
        if (onNavigateToMeeting) onNavigateToMeeting(meeting.id)
        return
      }

      setUploading(true)
      setError(null)
      try {
        await uploadMeetingAudio(activeTenantId, meeting.id, blob, durationRef.current)
        setUploading(false)
        onClose()
        if (onNavigateToMeeting) onNavigateToMeeting(meeting.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed")
        setUploading(false)
      }
    }

    recorder.stop()
  }, [meeting.id, activeTenantId, onClose, onNavigateToMeeting])

  const togglePause = useCallback(() => {
    if (!recorderRef.current) return
    if (isPaused) {
      recorderRef.current.resume()
      setIsPaused(false)
    } else {
      recorderRef.current.pause()
      setIsPaused(true)
    }
  }, [isPaused])

  // Start MediaRecorder on mount
  useEffect(() => {
    let mounted = true
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(5000) // collect in 5 s chunks
        recorderRef.current = recorder
      } catch {
        setError("Microphone access denied or unavailable.")
      }
    }
    start()
    return () => {
      mounted = false
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className={cn("flex h-2 w-2 rounded-full bg-red-500", isRecording && !isPaused && "animate-pulse")} />
          <Mic className="h-4 w-4" />
          {meeting.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
          <span className="font-mono text-2xl tabular-nums">{formatTime(elapsedMs)}</span>
          <div className="flex gap-2">
            {isRecording && (
              <Button variant="outline" size="icon" onClick={togglePause} disabled={uploading}>
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              onClick={stopRecording}
              disabled={uploading}
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {uploading && (
          <p className="text-sm text-muted-foreground">
            Uploading recording — transcript will be ready shortly…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Tip: You can join a Zoom or Teams call in another window; we'll capture your microphone.
        </p>
      </CardContent>
    </Card>
  )
}
