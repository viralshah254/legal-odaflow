"use client"
import { useTranslations } from "next-intl"

import { use, useEffect, useCallback, useState, useRef } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getMeeting, getMeetingTranscript, getMeetingNotes, resolveMeetingRecordingSrc, regenerateMeetingNotes, retryMeetingProcessing, updateMeetingStatus, deleteMeeting } from "@/lib/api/meetings"
import { getClient } from "@/lib/api/clients"
import { getMatter } from "@/lib/api/matters"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MeetingAudioPlayer } from "@/components/meetings/meeting-audio-player"
import { MeetingStatusChip } from "@/components/meetings/meeting-status-chip"
import { MeetingSecurityBadge } from "@/components/meetings/meeting-security-badge"
import { apiMeetingToMeeting } from "@/lib/meetings/api-meeting-to-meeting"
import { isOrphanedRecording } from "@/lib/meetings/recording-utils"
import { formatMediaDuration, formatRecordingClock, formatRecordingDurationLive } from "@/lib/meetings/format-duration"
import { useMeetingRecordingStore } from "@/lib/store/meeting-recording-store"
import { ArrowLeft, AlertTriangle, Bookmark, FileText, Loader2, Mic, Pause, Play, RefreshCw, Sparkles, Square, Trash2, X, Check, Wifi, WifiOff } from "lucide-react"
import { LiveTranscriptPanel } from "@/components/meetings/live-transcript-panel"
import { ConfirmDeleteMeetingDialog } from "@/components/meetings/confirm-delete-meeting-dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import type { MeetingStatus, ConfidentialityLevel } from "@/lib/types/meetings"

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }> | { meetingId: string }
}) {
  const t = useTranslations("lawyer")
  const tc = useTranslations("common")
  const meetingId = params instanceof Promise ? use(params).meetingId : params.meetingId
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()

  const refetchMeetingQueries = useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: ["meeting", activeTenantId, meetingId],
      type: "active",
    })
    void queryClient.refetchQueries({
      queryKey: ["meeting-transcript", activeTenantId, meetingId],
      type: "active",
    })
    void queryClient.refetchQueries({
      queryKey: ["meeting-notes", activeTenantId, meetingId],
      type: "active",
    })
  }, [queryClient, activeTenantId, meetingId])

  const invalidateMeetingQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["meeting", activeTenantId, meetingId] })
    queryClient.invalidateQueries({ queryKey: ["meeting-transcript", activeTenantId, meetingId] })
    queryClient.invalidateQueries({ queryKey: ["meeting-notes", activeTenantId, meetingId] })
  }, [queryClient, activeTenantId, meetingId])

  // Subscribe to real-time status updates — refetch immediately when worker completes.
  useRealtimeEvent(REALTIME_EVENTS.MEETING_STATUS_UPDATED, useCallback((payload) => {
    const dataMeetingId = payload.data?.meetingId as string | undefined
    if (payload.entityId === meetingId || dataMeetingId === meetingId) {
      refetchMeetingQueries()
    }
  }, [meetingId, refetchMeetingQueries]))

  const { data: meeting, isLoading, isPending, isError } = useApiData(
    ["meeting", activeTenantId, meetingId],
    {
      apiFn: () => getMeeting(activeTenantId!, meetingId),
      enabled: !!activeTenantId && !!meetingId,
    },
  )

  const { data: transcript } = useApiData(
    ["meeting-transcript", activeTenantId, meetingId],
    {
      apiFn: () => getMeetingTranscript(activeTenantId!, meetingId),
      enabled: !!activeTenantId && !!meetingId,
    },
  )

  const { data: notes = [] } = useApiData(
    ["meeting-notes", activeTenantId, meetingId],
    {
      apiFn: () => getMeetingNotes(activeTenantId!, meetingId),
      enabled: !!activeTenantId && !!meetingId,
    },
  )

  // Audio blob URL — loaded once the meeting is ready
  const [recordingSrc, setRecordingSrc] = useState<string | null>(null)
  const [recordingIsVideo, setRecordingIsVideo] = useState(false)
  const revokeRecordingSrcRef = useRef(false)
  const [audioLoading, setAudioLoading] = useState(false)

  // Regenerate notes state
  const [regenerating, setRegenerating] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [retryingProcess, setRetryingProcess] = useState(false)
  const autoRetryRef = useRef(false)

  const { data: client } = useApiData(
    ["client", activeTenantId, meeting?.clientId],
    {
      apiFn: () => getClient(activeTenantId!, meeting!.clientId!),
      enabled: !!activeTenantId && !!meeting?.clientId,
    },
  )

  const { data: matter } = useApiData(
    ["matter", activeTenantId, meeting?.matterId],
    {
      apiFn: () => getMatter(activeTenantId!, meeting!.matterId!),
      enabled: !!activeTenantId && !!meeting?.matterId,
    },
  )

  const status = (meeting?.status ?? "draft") as MeetingStatus

  const setActiveRecording = useMeetingRecordingStore((s) => s.setActiveRecording)
  const activeRecordingMeeting = useMeetingRecordingStore((s) => s.activeMeeting)
  const clearActiveRecordingIfMatching = useMeetingRecordingStore((s) => s.clearActiveRecordingIfMatching)
  const recorderControls = useMeetingRecordingStore((s) => s.controls)
  const liveTranscript = useMeetingRecordingStore((s) => s.liveTranscript)
  const liveInterimTranscript = useMeetingRecordingStore((s) => s.liveInterimTranscript)
  const liveTranscriptSegments = useMeetingRecordingStore((s) => s.liveTranscriptSegments)
  const transcriptionSource = useMeetingRecordingStore((s) => s.transcriptionSource)
  const quickNotes = useMeetingRecordingStore((s) => s.quickNotes)
  const setQuickNotes = useMeetingRecordingStore((s) => s.setQuickNotes)

  const [autoScroll, setAutoScroll] = useState(true)
  const transcriptScrollRef = useRef<HTMLDivElement>(null)

  // Processing elapsed timer
  const [processingElapsedMs, setProcessingElapsedMs] = useState(0)
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingStartRef = useRef<number | null>(null)

  const formatProcessingTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const rem = s % 60
    return m > 0 ? `${m}:${String(rem).padStart(2, "0")}` : `0:${String(rem).padStart(2, "0")}`
  }

  const mappedMeeting = meeting ? apiMeetingToMeeting(meeting) : null
  const interruptedRecording =
    mappedMeeting != null &&
    status === "recording" &&
    isOrphanedRecording(mappedMeeting)

  // Re-attach recorder when opening a meeting that is still in "recording" status
  useEffect(() => {
    if (!meeting || status !== "recording" || interruptedRecording) return
    if (activeRecordingMeeting?.id === meeting.id) return
    const { includeVideo, pendingMediaStream } = useMeetingRecordingStore.getState()
    setActiveRecording(apiMeetingToMeeting(meeting), {
      includeVideo,
      mediaStream: pendingMediaStream ?? undefined,
    })
  }, [meeting, status, interruptedRecording, activeRecordingMeeting?.id, setActiveRecording])

  const isLiveRecording =
    status === "recording" &&
    !interruptedRecording &&
    activeRecordingMeeting?.id === meetingId &&
    recorderControls != null

  const handleDiscardInterrupted = async () => {
    if (!activeTenantId || discarding) return
    setDiscarding(true)
    try {
      await updateMeetingStatus(activeTenantId, meetingId, "failed")
      clearActiveRecordingIfMatching(meetingId)
      invalidateMeetingQueries()
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    } finally {
      setDiscarding(false)
    }
  }

  const handleDeleteMeeting = async () => {
    if (!activeTenantId || deleting) return
    setDeleting(true)
    try {
      await deleteMeeting(activeTenantId, meetingId)
      clearActiveRecordingIfMatching(meetingId)
      await queryClient.invalidateQueries({ queryKey: ["meetings"] })
      toast({ title: tc("meeting_deleted") })
      router.push("/app/meetings")
    } catch {
      toast({ title: tc("error"), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  // Dismiss any stale recorder bar when this meeting was never saved.
  useEffect(() => {
    if (interruptedRecording) {
      clearActiveRecordingIfMatching(meetingId)
    }
  }, [interruptedRecording, meetingId, clearActiveRecordingIfMatching])

  // Poll while processing (fallback when realtime bridge is unavailable).
  useEffect(() => {
    if (status !== "processing") return
    void refetchMeetingQueries()
    const id = setInterval(() => void refetchMeetingQueries(), 1500)
    return () => clearInterval(id)
  }, [status, refetchMeetingQueries])

  // Processing elapsed timer — starts when status transitions to "processing"
  useEffect(() => {
    if (status !== "processing") {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
      processingStartRef.current = null
      setProcessingElapsedMs(0)
      return
    }
    if (processingStartRef.current === null) {
      processingStartRef.current = Date.now()
    }
    processingTimerRef.current = setInterval(() => {
      setProcessingElapsedMs(Date.now() - (processingStartRef.current ?? Date.now()))
    }, 1000)
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
    }
  }, [status])

  const handleRetryProcessing = useCallback(async () => {
    if (!activeTenantId || retryingProcess) return
    setRetryingProcess(true)
    try {
      const result = await retryMeetingProcessing(activeTenantId, meetingId)
      invalidateMeetingQueries()
      if (result.skipped) {
        queryClient.invalidateQueries({ queryKey: ["meeting", activeTenantId, meetingId] })
      }
    } finally {
      setRetryingProcess(false)
    }
  }, [activeTenantId, meetingId, retryingProcess, invalidateMeetingQueries, queryClient])

  // Re-queue only when processing appears stuck (no transcript saved yet).
  useEffect(() => {
    if (!activeTenantId || !meeting || status !== "processing" || autoRetryRef.current) return
    if (transcript?.rawText?.trim()) return
    autoRetryRef.current = true
    void handleRetryProcessing()
  }, [activeTenantId, meeting, status, transcript?.rawText, handleRetryProcessing])

  // Load recording URL once the meeting is ready (presigned S3 stream or blob fallback)
  useEffect(() => {
    if (status !== "ready" || !activeTenantId || !meetingId || recordingSrc || audioLoading) return
    setAudioLoading(true)
    resolveMeetingRecordingSrc(activeTenantId, meetingId)
      .then(({ src, isVideo, revokeOnCleanup }) => {
        revokeRecordingSrcRef.current = revokeOnCleanup
        setRecordingIsVideo(isVideo)
        setRecordingSrc(src)
      })
      .catch(() => { /* recording unavailable — not a hard error */ })
      .finally(() => setAudioLoading(false))
  }, [status, activeTenantId, meetingId, recordingSrc, audioLoading])

  // Clean up blob URL on unmount (presigned URLs need no revoke)
  useEffect(() => {
    return () => {
      if (recordingSrc && revokeRecordingSrcRef.current) URL.revokeObjectURL(recordingSrc)
    }
  }, [recordingSrc])

  // Auto-scroll live transcript panel
  useEffect(() => {
    if (!autoScroll || !transcriptScrollRef.current) return
    transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight
  }, [liveTranscript, liveInterimTranscript, autoScroll])

  const handleRegenerateNotes = async () => {
    if (!activeTenantId || regenerating) return
    setRegenerating(true)
    try {
      await regenerateMeetingNotes(activeTenantId, meetingId)
      queryClient.invalidateQueries({ queryKey: ["meeting-notes", activeTenantId, meetingId] })
    } finally {
      setRegenerating(false)
    }
  }

  if (!activeTenantId || isPending || isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !meeting) notFound()

  const confidentiality = (meeting.confidentiality ?? "standard") as ConfidentialityLevel
  const isDraftTranscript = transcript && !transcript.segments?.length && status !== "ready"

  // ── Full-screen live recording mode ──────────────────────────────────────
  if (isLiveRecording) {
    const markMoment = () => {
      const ts = formatRecordingClock(recorderControls.elapsedMs)
      const marker = `\n[${ts} ⭐ marked]`
      setQuickNotes(quickNotes + marker)
    }

    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-background">
        {/* ── Top control bar ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/app/meetings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <h1 className="flex-1 min-w-0 text-sm font-semibold truncate">{meeting.title}</h1>

          {/* Animated dot + timer + source badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono tabular-nums">{recorderControls.elapsedDisplay}</span>
            </div>
            {recorderControls.transcriptionSource === "deepgram" ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Wifi className="h-2.5 w-2.5" />
                Live STT
              </span>
            ) : recorderControls.transcriptionSource === "web-speech" ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <WifiOff className="h-2.5 w-2.5" />
                Draft
              </span>
            ) : null}
          </div>

          {/* Mark moment */}
          <Button variant="ghost" size="sm" onClick={markMoment} title="Mark this moment" className="shrink-0 gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark</span>
          </Button>

          {/* Mic permission prompt */}
          {!recorderControls.micReady && !recorderControls.uploading && (
            recorderControls.bootstrapping || recorderControls.requestingMic ? (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" disabled>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {recorderControls.requestingMic ? "Requesting mic…" : "Starting…"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void recorderControls.requestMicrophone()}
              >
                <Mic className="h-3.5 w-3.5" />
                Allow mic
              </Button>
            )
          )}

          {/* Pause / Resume */}
          {recorderControls.micReady && !recorderControls.uploading && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => recorderControls.togglePause()}
            >
              {recorderControls.isPaused ? (
                <><Play className="h-3.5 w-3.5" /><span className="hidden sm:inline">Resume</span></>
              ) : (
                <><Pause className="h-3.5 w-3.5" /><span className="hidden sm:inline">Pause</span></>
              )}
            </Button>
          )}

          {/* Stop & Save */}
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 gap-1.5 font-semibold"
            onClick={() => void recorderControls.stopRecording()}
            disabled={recorderControls.uploading || !recorderControls.micReady}
          >
            {recorderControls.uploading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Saving… {recorderControls.uploadProgress > 0 ? `${recorderControls.uploadProgress}%` : ""}</span></>
            ) : (
              <><Square className="h-3.5 w-3.5 fill-current" /><span>Stop & save</span></>
            )}
          </Button>
        </div>

        {recorderControls.error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-b">
            {recorderControls.error}
          </div>
        )}

        {recorderControls.captionsHint && !recorderControls.error && (
          <div className="px-4 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs border-b">
            {recorderControls.captionsHint}
          </div>
        )}

        {/* ── Two-column body ── */}
        <div className="flex flex-1 min-h-0 divide-x">
          {/* Left: Live transcript */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0 p-4">
            <LiveTranscriptPanel
              segments={
                liveTranscriptSegments.length > 0
                  ? liveTranscriptSegments
                  : liveTranscript
                    ? [{ text: liveTranscript, startMs: 0, endMs: 0 }]
                    : []
              }
              interimText={liveInterimTranscript}
              transcriptionSource={recorderControls.transcriptionSource ?? transcriptionSource}
              captionsListening={recorderControls.captionsListening}
              captionsUnavailable={recorderControls.captionsUnavailable}
              captionsHint={recorderControls.captionsHint}
              isBootstrapping={recorderControls.bootstrapping}
              micReady={recorderControls.micReady}
              isPaused={recorderControls.isPaused}
              autoScroll={autoScroll}
              onAutoScrollChange={setAutoScroll}
            />
          </div>

          {/* Right: Quick notes + Meeting info */}
          <div className="w-80 xl:w-96 shrink-0 flex flex-col min-h-0 p-4 gap-4">
            {/* Quick notes */}
            <div className="flex flex-col flex-1 min-h-0 gap-2">
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick Notes</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 gap-1"
                  onClick={markMoment}
                  title="Insert a timestamp bookmark"
                >
                  <Bookmark className="h-3 w-3" />
                  Mark
                </Button>
              </div>
              <Textarea
                className="flex-1 resize-none min-h-0 text-sm font-mono"
                placeholder="Type notes here… Use Mark to insert timestamps."
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
              />
            </div>

            {/* Smart notes placeholder — generated after Stop & save */}
            <div className="shrink-0 rounded-lg border border-dashed bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Smart notes (after save)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                AI summary, action items, and a corrected transcript are created when you click{" "}
                <span className="font-medium text-foreground">Stop &amp; save</span>. Quick notes above are included.
              </p>
            </div>

            {/* Meeting info */}
            <div className="shrink-0 rounded-lg border bg-muted/20 p-3 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Meeting Info</h2>
              <div className="space-y-1.5 text-sm">
                {client && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs w-14 shrink-0 font-medium">Client</span>
                    <span className="truncate">{client.name}</span>
                  </div>
                )}
                {matter && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs w-14 shrink-0 font-medium">Matter</span>
                    <span className="truncate">{matter.title}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs w-14 shrink-0 font-medium">Status</span>
                  <MeetingStatusChip status={status} />
                </div>
                {meeting.participants && meeting.participants.length > 0 && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-xs w-14 shrink-0 font-medium mt-0.5">People</span>
                    <span className="text-xs leading-relaxed">{meeting.participants.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal (non-recording) page ───────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={client && meeting.clientId ? `/app/clients/${meeting.clientId}` : "/app/meetings"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{meeting.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <MeetingStatusChip status={status} />
            <MeetingSecurityBadge level={confidentiality} />
            {client && meeting.clientId && (
              <Link href={`/app/clients/${meeting.clientId}`} className="text-sm text-muted-foreground hover:underline">
                {client.name}
              </Link>
            )}
            {matter && (
              <Link href={`/app/matters/${meeting.matterId}`} className="text-sm text-muted-foreground hover:underline">
                {matter.title}
              </Link>
            )}
            {meeting.durationMs != null && meeting.durationMs > 0 && (
              <span className="text-sm text-muted-foreground">
                · {formatMediaDuration(meeting.durationMs)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40"
          onClick={() => setDeleteOpen(true)}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
          {tc("delete")}
        </Button>
      </div>

      <ConfirmDeleteMeetingDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        meetingTitle={meeting.title}
        onConfirm={handleDeleteMeeting}
        deleting={deleting}
      />

      {/* Interrupted recording — browser session was lost; audio cannot be recovered */}
      {interruptedRecording && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Recording interrupted</p>
              <p className="text-xs text-muted-foreground">
                This recording was never saved. The live audio is no longer available in your browser.
                Discard it to remove this entry, or start a new recording.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleDiscardInterrupted()}
              disabled={discarding}
            >
              {discarding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Discard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Processing banner */}
      {status === "processing" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium">
                    {transcript?.rawText?.trim()
                      ? "Generating AI notes"
                      : "Generating final transcript"}
                  </p>
                  {processingElapsedMs > 0 && (
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {formatProcessingTime(processingElapsedMs)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI is processing your audio — this usually takes 1–2 minutes.
                  {transcript && " A draft is shown below."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void handleRetryProcessing()}
                disabled={retryingProcess}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retryingProcess ? "animate-spin" : ""}`} />
                {retryingProcess ? "Retrying…" : "Retry processing"}
              </Button>
            </div>
            {/* 3-step progress stepper */}
            <div className="flex items-center gap-1 text-xs">
              {/* Step 1: Audio saved */}
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="hidden sm:inline">Audio saved</span>
              </div>
              <span className="flex-1 border-t border-dashed border-primary/30 mx-1" />
              {/* Step 2: Transcribing */}
              <div className={`flex items-center gap-1.5 ${!transcript ? "text-primary" : "text-emerald-600 dark:text-emerald-400"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full ${!transcript ? "bg-primary/20 text-primary" : "bg-emerald-500/20"}`}>
                  {!transcript ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="hidden sm:inline">Transcribing</span>
              </div>
              <span className="flex-1 border-t border-dashed border-primary/30 mx-1" />
              {/* Step 3: Generating notes */}
              <div className={`flex items-center gap-1.5 ${transcript && notes.length === 0 ? "text-primary" : notes.length > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full ${transcript && notes.length === 0 ? "bg-primary/20" : notes.length > 0 ? "bg-emerald-500/20" : "bg-muted/30"}`}>
                  {transcript && notes.length === 0 ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : notes.length > 0 ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </span>
                <span className="hidden sm:inline">Generating notes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transcript" className="w-full">
        <TabsList>
          <TabsTrigger value="transcript">{t("transcript")}</TabsTrigger>
          <TabsTrigger value="notes">{t("smart_notes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transcript
                {isDraftTranscript && (
                  <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Live draft
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {status === "ready" && transcript
                  ? "AI-generated transcript from your recording."
                  : status === "processing" && transcript
                    ? "Live draft from in-browser captions. Final transcript arriving shortly…"
                    : status === "processing"
                      ? "Transcript is being generated…"
                      : status === "recording"
                        ? "Transcript will appear here once the recording is saved."
                        : "No transcript yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audio player — shown once the recording is ready */}
              {status === "ready" && (recordingSrc || audioLoading) && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  {audioLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading recording…
                    </div>
                  ) : recordingSrc ? (
                    <MeetingAudioPlayer
                      src={recordingSrc}
                      durationMs={meeting.durationMs}
                      isVideo={recordingIsVideo}
                    />
                  ) : null}
                </div>
              )}

              {/* Show spinner only if processing with no draft yet */}
              {status === "processing" && !transcript && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("processing_this_usually_takes_a_minute")}
                </div>
              )}

              {/* Segmented transcript (Whisper with timed paragraphs) */}
              {transcript?.segments && transcript.segments.length > 0 ? (
                <div className="space-y-3">
                  {transcript.segments.map((seg, i) => (
                    <div key={i} className="flex gap-3 group">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground w-14 pt-0.5 tabular-nums">
                        {formatRecordingClock(seg.startMs)}
                      </span>
                      <p className={`text-sm leading-relaxed flex-1 ${isDraftTranscript ? "text-muted-foreground" : ""}`}>
                        {seg.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : transcript?.rawText ? (
                /* Fallback: plain text (web-speech-api draft or legacy transcript) */
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDraftTranscript ? "text-muted-foreground" : ""}`}>
                  {transcript.rawText}
                </p>
              ) : status !== "processing" && status !== "recording" ? (
                <p className="text-sm text-muted-foreground py-4">No transcript available.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t("meeting_notes")}
                </CardTitle>
                {status === "ready" && transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateNotes}
                    disabled={regenerating}
                    className="shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
                    {regenerating ? "Generating…" : "Regenerate notes"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {status === "processing" && notes.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI notes are being generated…
                </div>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("no_notes_yet")}</p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 rounded-lg border">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {note.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
