"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { formatRecordingClock } from "@/lib/meetings/format-duration"
import { cn } from "@/lib/utils"

interface MeetingAudioPlayerProps {
  src: string
  durationMs?: number | null
  isVideo?: boolean
  className?: string
}

export function MeetingAudioPlayer({ src, durationMs, isVideo = false, className }: MeetingAudioPlayerProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null)
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [totalMs, setTotalMs] = useState(durationMs ?? 0)
  const [muted, setMuted] = useState(false)
  const [bufferedPct, setBufferedPct] = useState<Array<{ start: number; end: number }>>([])

  const isTimeBuffered = useCallback((timeSec: number) => {
    const media = mediaRef.current
    if (!media) return false
    for (let i = 0; i < media.buffered.length; i++) {
      if (timeSec >= media.buffered.start(i) && timeSec <= media.buffered.end(i)) {
        return true
      }
    }
    return false
  }, [])

  const syncBuffered = useCallback(() => {
    const media = mediaRef.current
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return
    const duration = media.duration
    const ranges: Array<{ start: number; end: number }> = []
    for (let i = 0; i < media.buffered.length; i++) {
      ranges.push({
        start: (media.buffered.start(i) / duration) * 100,
        end: (media.buffered.end(i) / duration) * 100,
      })
    }
    setBufferedPct(ranges)
  }, [])

  const startBuffering = useCallback((immediate = false) => {
    if (immediate) {
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current)
        waitingTimerRef.current = null
      }
      setIsBuffering(true)
      return
    }
    if (waitingTimerRef.current) return
    waitingTimerRef.current = setTimeout(() => {
      setIsBuffering(true)
      waitingTimerRef.current = null
    }, 120)
  }, [])

  const stopBuffering = useCallback(() => {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current)
      waitingTimerRef.current = null
    }
    setIsBuffering(false)
  }, [])

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    const onTimeUpdate = () => setCurrentMs(Math.floor(media.currentTime * 1000))
    const onLoadedMetadata = () => {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        setTotalMs(Math.floor(media.duration * 1000))
      }
      syncBuffered()
    }
    const onProgress = () => syncBuffered()
    const onEnded = () => {
      setPlaying(false)
      stopBuffering()
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onSeeking = () => {
      if (!isTimeBuffered(media.currentTime)) {
        startBuffering(true)
      }
    }
    const onWaiting = () => startBuffering(false)
    const onStalled = () => startBuffering(false)
    const onCanPlay = () => stopBuffering()
    const onPlaying = () => stopBuffering()

    media.addEventListener("timeupdate", onTimeUpdate)
    media.addEventListener("loadedmetadata", onLoadedMetadata)
    media.addEventListener("durationchange", onLoadedMetadata)
    media.addEventListener("progress", onProgress)
    media.addEventListener("ended", onEnded)
    media.addEventListener("play", onPlay)
    media.addEventListener("pause", onPause)
    media.addEventListener("seeking", onSeeking)
    media.addEventListener("waiting", onWaiting)
    media.addEventListener("stalled", onStalled)
    media.addEventListener("canplay", onCanPlay)
    media.addEventListener("playing", onPlaying)

    return () => {
      media.removeEventListener("timeupdate", onTimeUpdate)
      media.removeEventListener("loadedmetadata", onLoadedMetadata)
      media.removeEventListener("durationchange", onLoadedMetadata)
      media.removeEventListener("progress", onProgress)
      media.removeEventListener("ended", onEnded)
      media.removeEventListener("play", onPlay)
      media.removeEventListener("pause", onPause)
      media.removeEventListener("seeking", onSeeking)
      media.removeEventListener("waiting", onWaiting)
      media.removeEventListener("stalled", onStalled)
      media.removeEventListener("canplay", onCanPlay)
      media.removeEventListener("playing", onPlaying)
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current)
        waitingTimerRef.current = null
      }
    }
  }, [src, startBuffering, stopBuffering, syncBuffered, isTimeBuffered])

  useEffect(() => {
    if (durationMs != null && durationMs > 0) {
      setTotalMs((prev) => (prev > 0 ? prev : durationMs))
    }
  }, [durationMs])

  const togglePlay = useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) void media.play()
    else media.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    media.muted = !media.muted
    setMuted(media.muted)
  }, [])

  const seekToRatio = useCallback(
    (ratio: number) => {
      const media = mediaRef.current
      if (!media || totalMs <= 0) return
      const targetSec = (ratio * totalMs) / 1000
      if (!isTimeBuffered(targetSec)) {
        startBuffering(true)
      }
      media.currentTime = targetSec
      setCurrentMs(Math.floor(ratio * totalMs))
    },
    [totalMs, startBuffering, isTimeBuffered],
  )

  const seek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      seekToRatio(ratio)
    },
    [seekToRatio],
  )

  const progress = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0

  return (
    <div
      aria-busy={isBuffering}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5",
        "dark:border-blue-800 dark:bg-blue-950/40",
        isBuffering && "ring-1 ring-blue-300/60 dark:ring-blue-700/60",
        className,
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {isVideo ? (
        <video ref={mediaRef as React.RefObject<HTMLVideoElement>} src={src} preload="auto" className="hidden" playsInline />
      ) : (
        <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={src} preload="auto" className="hidden" />
      )}

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isBuffering ? "Loading" : playing ? "Pause" : "Play"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors",
          isBuffering ? "cursor-wait opacity-90" : "hover:bg-blue-700",
        )}
      >
        {isBuffering ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={totalMs}
        aria-valuenow={currentMs}
        tabIndex={0}
        onClick={seek}
        onKeyDown={(e) => {
          const media = mediaRef.current
          if (!media || totalMs <= 0) return
          const step = 5000
          if (e.key === "ArrowRight") {
            const target = Math.min(totalMs / 1000, media.currentTime + step / 1000)
            if (!isTimeBuffered(target)) startBuffering(true)
            media.currentTime = target
          } else if (e.key === "ArrowLeft") {
            const target = Math.max(0, media.currentTime - step / 1000)
            if (!isTimeBuffered(target)) startBuffering(true)
            media.currentTime = target
          }
        }}
        className={cn(
          "group relative flex-1 min-w-0 py-2",
          isBuffering ? "cursor-wait" : "cursor-pointer",
        )}
      >
        <div
          className={cn(
            "relative h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900",
            isBuffering && "animate-pulse",
          )}
        >
          {bufferedPct.map((range, index) => (
            <div
              key={`buffered-${index}`}
              className="pointer-events-none absolute inset-y-0 rounded-full bg-blue-300/70 dark:bg-blue-700/50"
              style={{ left: `${range.start}%`, width: `${Math.max(0, range.end - range.start)}%` }}
              aria-hidden
            />
          ))}
          <div
            className={cn(
              "h-full rounded-full bg-blue-600 transition-[width] duration-75 ease-linear",
              isBuffering && "opacity-80",
            )}
            style={{ width: `${progress}%` }}
          />
          {isBuffering && (
            <>
              <span
                className="pointer-events-none absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/70 motion-safe:animate-ping"
                style={{ left: `${progress}%` }}
                aria-hidden
              />
              <span
                className="pointer-events-none absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-sm"
                style={{ left: `${progress}%` }}
                aria-hidden
              />
            </>
          )}
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums text-blue-900 dark:text-blue-100">
        {isBuffering && (
          <span className="sr-only">Loading</span>
        )}
        {formatRecordingClock(currentMs)} / {formatRecordingClock(totalMs)}
        {isBuffering && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-600 dark:text-blue-300" aria-hidden />
        )}
      </span>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/60 transition-colors"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  )
}
