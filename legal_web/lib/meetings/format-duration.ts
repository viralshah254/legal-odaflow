/** Clock display for live recording: `M:SS`, `MM:SS`, or `H:MM:SS`. */
export function formatRecordingClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Human-readable label: `45 sec`, `2 min 14 sec`, `1 hr 5 min`. */
export function formatMediaDuration(ms?: number | null, { compact = false } = {}): string {
  if (ms == null || ms < 0 || !Number.isFinite(ms)) return "—"
  const totalSec = Math.round(ms / 1000)
  if (totalSec === 0) return compact ? "0 sec" : "0 seconds"

  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const parts: string[] = []
  if (h > 0) parts.push(compact ? `${h} hr` : `${h} ${h === 1 ? "hour" : "hours"}`)
  if (m > 0) parts.push(compact ? `${m} min` : `${m} ${m === 1 ? "minute" : "minutes"}`)
  if (s > 0 && h === 0) parts.push(compact ? `${s} sec` : `${s} ${s === 1 ? "second" : "seconds"}`)
  if (parts.length === 0) return compact ? "0 sec" : "0 seconds"
  return parts.join(" ")
}

/** Combined live display: `2:14 · 2 min 14 sec` */
export function formatRecordingDurationLive(ms: number): string {
  return `${formatRecordingClock(ms)} · ${formatMediaDuration(ms, { compact: true })}`
}
