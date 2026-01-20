"use client"

import { TimelineEvent, getTimelineEventIcon } from "@/lib/types/timeline"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface MatterTimelineProps {
  events: TimelineEvent[]
  className?: string
}

export function MatterTimeline({ events, className }: MatterTimelineProps) {
  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="flex gap-4 relative">
              {/* Timeline line */}
              {index < events.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
              )}
              
              {/* Icon */}
              <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
                {getTimelineEventIcon(event.type)}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm">{event.title}</div>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(event.createdAt), "MMM d, yyyy")}
                  </Badge>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground mb-1">{event.description}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  by {event.userName} • {format(new Date(event.createdAt), "h:mm a")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

