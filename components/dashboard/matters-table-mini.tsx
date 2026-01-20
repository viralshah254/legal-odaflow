"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Matter } from "@/lib/mock/matters"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface MattersTableMiniProps {
  matters: Matter[]
  showOwner?: boolean
  className?: string
}

export function MattersTableMini({ matters, showOwner = false, className }: MattersTableMiniProps) {
  if (matters.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Active Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No active matters</p>
        </CardContent>
      </Card>
    )
  }

  const getRiskColor = (risk: Matter["risk"]) => {
    switch (risk) {
      case "Critical":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
      case "High":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20"
      case "Medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
      default:
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Active Matters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {matters.map((matter) => {
            const isDeadlineSoon = matter.nextDeadline && new Date(matter.nextDeadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

            return (
              <div
                key={matter.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5">
                  {isDeadlineSoon ? (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link
                      href={`/app/matters/${matter.id}`}
                      className="font-medium text-sm hover:text-primary transition-colors"
                    >
                      {matter.title}
                    </Link>
                    <Badge variant="outline" className={cn("text-xs shrink-0", getRiskColor(matter.risk))}>
                      {matter.risk}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{matter.ref}</span>
                    <span>•</span>
                    <span>{matter.clientName}</span>
                    {showOwner && (
                      <>
                        <span>•</span>
                        <span>{matter.ownerName}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {matter.stage}
                    </Badge>
                    {matter.nextDeadline && (
                      <span className={cn("text-muted-foreground", isDeadlineSoon && "text-orange-600 dark:text-orange-400 font-medium")}>
                        Deadline: {format(new Date(matter.nextDeadline), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

