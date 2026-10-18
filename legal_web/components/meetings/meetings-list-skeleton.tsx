import { cn } from "@/lib/utils"

export function MeetingsListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <ul
      className={cn("space-y-2 animate-pulse", className)}
      aria-busy="true"
      aria-label="Loading meetings"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted/70" />
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="h-3 w-24 rounded bg-muted/60" />
            <div className="h-3 w-32 rounded bg-muted/60" />
            <div className="h-3 w-28 rounded bg-muted/60" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MeetingsListProgressBar({ active }: { active: boolean }) {
  if (!active) {
    return <div className="h-0.5" aria-hidden />
  }

  return (
    <div
      className="relative h-0.5 w-full overflow-hidden bg-muted"
      role="progressbar"
      aria-label="Loading meetings"
    >
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[meetings-indeterminate_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  )
}
