import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CitationBadgeProps {
  index: number
  className?: string
}

export function CitationBadge({ index, className }: CitationBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn("shrink-0 tabular-nums text-xs font-mono", className)}
    >
      [{index}]
    </Badge>
  )
}
