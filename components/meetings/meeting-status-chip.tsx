"use client"

import { Badge } from "@/components/ui/badge"
import type { MeetingStatus } from "@/lib/types/meetings"
import { cn } from "@/lib/utils"
import { Loader2, Mic, Upload, CheckCircle2, XCircle, FileUp } from "lucide-react"

const statusConfig: Record<
  MeetingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon?: React.ElementType }
> = {
  draft: { label: "Draft", variant: "outline", icon: FileUp },
  recording: { label: "Recording", variant: "default", icon: Mic },
  uploaded: { label: "Uploaded", variant: "secondary", icon: Upload },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  ready: { label: "Ready", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
}

export function MeetingStatusChip({ status, className }: { status: MeetingStatus; className?: string }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className={cn("gap-1.5 font-normal", className)}>
      {status === "processing" && Icon ? (
        <Icon className="h-3.5 w-3.5 animate-spin" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : null}
      {config.label}
    </Badge>
  )
}
