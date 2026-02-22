"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Meeting } from "@/lib/types/meetings"
import { finishRecordingAndProcess } from "@/lib/mock/meetings"
import { useRole } from "@/lib/contexts/role-context"
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
  const { currentUser } = useRole()
  const userId = currentUser?.id ?? "1"

  const [isRecording, setIsRecording] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isRecording || isPaused) return
    timerRef.current = setInterval(() => {
      setElapsedMs((prev) => prev + 500)
    }, 500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      onClose()
      return
    }
    recorderRef.current.stop()
    setIsRecording(false)
    setUploading(true)
    setError(null)
    try {
      const durationMs = elapsedMs
      finishRecordingAndProcess(meeting.id, durationMs, userId)
      setUploading(false)
      onClose()
      if (onNavigateToMeeting) {
        onNavigateToMeeting(meeting.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
      setUploading(false)
    } finally {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [meeting.id, elapsedMs, userId, onClose, onNavigateToMeeting])

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
        recorder.start(5000)
        recorderRef.current = recorder
      } catch (e) {
        setError("Microphone access denied or unavailable.")
      }
    }
    start()
    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const displayMs = elapsedMs

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className={cn("flex h-2 w-2 rounded-full bg-red-500", isRecording && !isPaused && "animate-pulse")} />
          Recording: {meeting.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
          <span className="font-mono text-2xl tabular-nums">{formatTime(displayMs)}</span>
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
          <p className="text-sm text-muted-foreground">Uploading and processing… Transcript will be ready shortly.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Tip: You can join a Zoom or Teams call in another window; we’ll capture your microphone.
        </p>
      </CardContent>
    </Card>
  )
}
