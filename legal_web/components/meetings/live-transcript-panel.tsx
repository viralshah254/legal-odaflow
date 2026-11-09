"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRecordingClock } from "@/lib/meetings/format-duration"
import { Wifi, WifiOff, Mic } from "lucide-react"

export interface TranscriptSegment {
  text: string
  startMs: number
  endMs: number
}

interface LiveTranscriptPanelProps {
  segments: TranscriptSegment[]
  interimText: string
  transcriptionSource: "deepgram" | "web-speech" | "none"
  captionsListening: boolean
  captionsUnavailable: boolean
  captionsHint: string | null
  isBootstrapping: boolean
  micReady: boolean
  isPaused: boolean
  autoScroll: boolean
  onAutoScrollChange: (value: boolean) => void
  /** Optional: live audio level 0–1 for waveform animation */
  audioLevel?: number
  className?: string
}

const SOURCE_LABELS: Record<"deepgram" | "web-speech" | "none", string> = {
  deepgram: "Live",
  "web-speech": "Draft",
  none: "",
}

export function LiveTranscriptPanel({
  segments,
  interimText,
  transcriptionSource,
  captionsListening,
  captionsUnavailable,
  captionsHint,
  isBootstrapping,
  micReady,
  isPaused,
  autoScroll,
  onAutoScrollChange,
  className,
}: LiveTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new segments arrive
  useEffect(() => {
    if (!autoScroll) return
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [segments, interimText, autoScroll])

  const isEmpty = segments.length === 0 && !interimText.trim()

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 gap-3", className)}>
      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Live Transcript
          </h2>
          {transcriptionSource !== "none" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                transcriptionSource === "deepgram"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}
            >
              {transcriptionSource === "deepgram" ? (
                <Wifi className="h-2.5 w-2.5" />
              ) : (
                <WifiOff className="h-2.5 w-2.5" />
              )}
              {SOURCE_LABELS[transcriptionSource]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            {transcriptionSource === "deepgram"
              ? "Deepgram cloud STT — final transcript on save."
              : "Draft captions — the transcript is refined after saving."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => onAutoScrollChange(!autoScroll)}
          >
            {autoScroll ? "Lock scroll" : "Auto-scroll"}
          </Button>
        </div>
      </div>

      {/* Transcript scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed relative"
      >
        {isPaused && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg gap-2 z-10">
            <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
              <span className="text-xl">⏸</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Recording paused</p>
            <p className="text-xs text-muted-foreground/70">Resume to continue transcription</p>
          </div>
        )}

        {isEmpty ? (
          <p className="text-muted-foreground/50 italic text-center mt-8 px-4">
            {captionsHint
              ? captionsHint
              : captionsUnavailable
                ? "Live captions aren't available in this browser. Your voice is still being recorded."
                : isBootstrapping
                  ? "Starting recording…"
                  : micReady
                    ? captionsListening
                      ? transcriptionSource === "deepgram"
                        ? "Connected — start speaking"
                        : "Listening… start speaking (use Chrome for best live captions)"
                      : "Starting live captions…"
                    : "Allow microphone access to begin recording"}
          </p>
        ) : (
          <div className="space-y-0.5">
            {/* Timestamped segments */}
            {segments.map((seg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 group py-0.5",
                  i === segments.length - 1 && !interimText
                    ? "animate-in fade-in slide-in-from-bottom-1 duration-300"
                    : "",
                )}
              >
                {transcriptionSource === "deepgram" && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60 w-10 pt-0.5 tabular-nums">
                    {formatRecordingClock(seg.startMs)}
                  </span>
                )}
                <p
                  className={cn(
                    "flex-1 text-sm leading-relaxed",
                    i === segments.length - 1 && !interimText
                      ? "text-foreground"
                      : "text-foreground/80",
                  )}
                >
                  {seg.text}
                </p>
              </div>
            ))}

            {/* Interim (partial) text with blinking cursor */}
            {interimText && (
              <div className="flex gap-3 py-0.5">
                {transcriptionSource === "deepgram" && (
                  <span className="shrink-0 w-10" />
                )}
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground/60 italic">
                  {interimText}
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status / waveform strip */}
      <div className="flex items-center gap-2 shrink-0 h-8">
        {micReady && !isPaused && (
          <div className="flex items-end gap-0.5 h-5">
            {[3, 6, 4, 7, 5, 8, 4, 6, 3, 5, 7, 4].map((h, i) => (
              <span
                key={i}
                className={cn(
                  "w-0.5 rounded-full",
                  transcriptionSource === "deepgram" ? "bg-emerald-500" : "bg-red-500",
                  "opacity-80",
                )}
                style={{
                  height: `${h * 2.5}px`,
                  animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        )}
        {!micReady && !isPaused && (
          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          {isBootstrapping
            ? "Connecting microphone…"
            : isPaused
              ? "Paused — resume when ready"
              : micReady
                ? captionsListening
                  ? transcriptionSource === "deepgram"
                    ? "Speak clearly — live transcription active"
                    : "Speak clearly — recording in progress"
                  : "Starting live captions…"
                : "Allow microphone access to start"}
        </span>
      </div>
    </div>
  )
}
