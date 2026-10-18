"use client"

import { Badge } from "@/components/ui/badge"

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NEW: "default",
  OPEN: "default",
  ACCEPTED: "secondary",
  CONVERTED: "outline",
  REJECTED: "destructive",
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
