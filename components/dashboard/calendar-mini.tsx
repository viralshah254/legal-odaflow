"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarEvent } from "@/lib/mock/calendar"
import { Clock, MapPin, Users } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface CalendarMiniProps {
  events: CalendarEvent[]
  className?: string
}

export function CalendarMini({ events, className }: CalendarMiniProps) {
  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming events</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event) => {
            const isToday = format(new Date(event.startAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
            const isTomorrow =
              format(new Date(event.startAt), "yyyy-MM-dd") ===
              format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd")

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link
                      href={`/app/calendar?event=${event.id}`}
                      className="font-medium text-sm hover:text-primary transition-colors"
                    >
                      {event.title}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {isToday
                        ? "Today"
                        : isTomorrow
                        ? "Tomorrow"
                        : format(new Date(event.startAt), "MMM d")}
                    </span>
                  </div>
                  {event.description && <p className="text-xs text-muted-foreground mb-1">{event.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(event.startAt), "h:mm a")}</span>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.attendeeNames.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{event.attendeeNames.length} attendee{event.attendeeNames.length > 1 ? "s" : ""}</span>
                      </div>
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

