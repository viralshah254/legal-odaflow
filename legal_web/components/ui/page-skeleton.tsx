import { cn } from "@/lib/utils"

interface PageSkeletonProps {
  rows?: number
  className?: string
}

export function PageSkeleton({ rows = 6, className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-4 animate-pulse", className)} aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 rounded-md bg-muted" />
      <div className="h-4 w-2/3 rounded-md bg-muted" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg border border-border/50 bg-muted/40" />
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl border border-border/50 bg-muted/40" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse" aria-busy="true">
      <div className="h-10 rounded-md bg-muted/60" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-md bg-muted/30" />
      ))}
    </div>
  )
}
