"use client"

import { Wifi, WifiOff, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useRealtime } from "@/lib/contexts/realtime-context"
import { cn } from "@/lib/utils"

export function RealtimeStatusBadge({ className }: { className?: string }) {
  const { status } = useRealtime()

  if (status === "connected") {
    return (
      <Badge variant="outline" className={cn("gap-1 text-xs font-normal hidden lg:flex", className)}>
        <Wifi className="h-3 w-3 text-green-600" />
        Live
      </Badge>
    )
  }

  if (status === "connecting" || status === "reconnecting") {
    return (
      <Badge variant="outline" className={cn("gap-1 text-xs font-normal hidden lg:flex", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-normal hidden lg:flex text-muted-foreground", className)}>
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  )
}
