"use client"

import { useState, useMemo } from "react"
import { CalendarEvent } from "@/lib/mock/calendar"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, startOfDay, getDay } from "date-fns"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users, FileText, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

type ViewMode = "month" | "week" | "agenda"

interface CalendarViewProps {
  events: CalendarEvent[]
  currentDate?: Date
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

const eventTypeColors: Record<CalendarEvent["type"], string> = {
  Meeting: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Hearing: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Deadline: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  Appointment: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
  Other: "bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30",
}

export function CalendarView({ events, currentDate = new Date(), onDateClick, onEventClick }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedDate, setSelectedDate] = useState(currentDate)

  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekStart = startOfWeek(selectedDate)
  const weekEnd = endOfWeek(selectedDate)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const dateKey = format(startOfDay(event.startAt), "yyyy-MM-dd")
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(event)
    })
    return map
  }, [events])

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateKey = format(startOfDay(date), "yyyy-MM-dd")
    return eventsByDate.get(dateKey) || []
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)))
  }

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  }, [events])

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => viewMode === "month" ? navigateMonth("prev") : navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => viewMode === "month" ? navigateMonth("next") : navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-xl font-semibold ml-4">
            {viewMode === "month" ? format(selectedDate, "MMMM yyyy") : viewMode === "week" ? `Week of ${format(weekStart, "MMM d")}` : "Agenda"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>
            Month
          </Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setViewMode("week")}>
            Week
          </Button>
          <Button variant={viewMode === "agenda" ? "default" : "outline"} size="sm" onClick={() => setViewMode("agenda")}>
            Agenda
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode === "month" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {/* Calendar Days */}
              {monthDays.map((day) => {
                const dayEvents = getEventsForDate(day)
                const isCurrentMonth = isSameMonth(day, selectedDate)
                const isToday = isSameDay(day, new Date())
                const isSelected = isSameDay(day, selectedDate)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] p-2 border border-border/50 rounded-lg transition-colors",
                      !isCurrentMonth && "opacity-40",
                      isToday && "bg-primary/10 border-primary/50",
                      isSelected && "ring-2 ring-primary",
                      "hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={() => {
                      setSelectedDate(day)
                      onDateClick?.(day)
                    }}
                  >
                    <div className={cn("text-sm font-medium mb-1", isToday && "text-primary font-bold")}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "text-xs p-1 rounded border truncate cursor-pointer hover:opacity-80",
                            eventTypeColors[event.type]
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick?.(event)
                          }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-[10px] opacity-75">{format(event.startAt, "h:mm a")}</div>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "week" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-8 gap-2">
              {/* Time column header */}
              <div className="text-sm font-medium text-muted-foreground"></div>
              {/* Day headers */}
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="text-center">
                  <div className="text-sm font-medium text-muted-foreground">{format(day, "EEE")}</div>
                  <div className={cn("text-lg font-semibold mt-1", isSameDay(day, new Date()) && "text-primary")}>
                    {format(day, "d")}
                  </div>
                </div>
              ))}
              {/* Time slots */}
              {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                <div key={hour} className="contents">
                  <div className="text-xs text-muted-foreground pr-2 text-right border-t border-border/50 pt-1">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </div>
                  {weekDays.map((day) => {
                    const dayEvents = getEventsForDate(day).filter(
                      (event) => event.startAt.getHours() === hour || (event.startAt.getHours() < hour && event.endAt.getHours() > hour)
                    )
                    return (
                      <div key={`${day.toISOString()}-${hour}`} className="border-t border-border/50 min-h-[60px] relative">
                        {dayEvents.map((event) => {
                          const startHour = event.startAt.getHours()
                          const startMinute = event.startAt.getMinutes()
                          const endHour = event.endAt.getHours()
                          const endMinute = event.endAt.getMinutes()
                          const top = startHour === hour ? (startMinute / 60) * 60 : 0
                          const height =
                            startHour === hour
                              ? ((endHour - startHour) * 60 + (endMinute - startMinute)) / 60 * 60
                              : endHour > hour
                              ? 60
                              : 0

                          if (startHour !== hour && endHour <= hour) return null

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "absolute left-0 right-0 mx-1 p-1 rounded text-xs cursor-pointer hover:opacity-80 z-10",
                                eventTypeColors[event.type]
                              )}
                              style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                              onClick={() => onEventClick?.(event)}
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              <div className="text-[10px] opacity-75">
                                {format(event.startAt, "h:mm")} - {format(event.endAt, "h:mm a")}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "agenda" && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {sortedEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No events scheduled</div>
              ) : (
                sortedEvents.map((event, index) => {
                  const eventDate = format(event.startAt, "yyyy-MM-dd")
                  const prevEventDate = index > 0 ? format(sortedEvents[index - 1].startAt, "yyyy-MM-dd") : null
                  const showDateHeader = eventDate !== prevEventDate

                  return (
                    <div key={event.id}>
                      {showDateHeader && (
                        <div className="sticky top-0 bg-background z-10 py-2 mb-2 border-b border-border">
                          <h3 className="text-lg font-semibold">
                            {isSameDay(event.startAt, new Date())
                              ? "Today"
                              : isSameDay(event.startAt, new Date(Date.now() + 24 * 60 * 60 * 1000))
                              ? "Tomorrow"
                              : format(event.startAt, "EEEE, MMMM d, yyyy")}
                          </h3>
                        </div>
                      )}
                      <div
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          eventTypeColors[event.type]
                        )}
                        onClick={() => onEventClick?.(event)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-4 w-4" />
                              <span className="font-semibold">{event.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {event.type}
                              </Badge>
                            </div>
                            {event.description && <p className="text-sm text-muted-foreground mb-2">{event.description}</p>}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {format(event.startAt, "h:mm a")} - {format(event.endAt, "h:mm a")}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.attendeeNames.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{event.attendeeNames.join(", ")}</span>
                                </div>
                              )}
                              {event.clientName && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <Link href={`/app/clients/${event.clientId}`} className="hover:text-primary hover:underline">
                                    {event.clientName}
                                  </Link>
                                </div>
                              )}
                              {event.matterTitle && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <Link href={`/app/matters/${event.matterId}`} className="hover:text-primary hover:underline">
                                    {event.matterTitle}
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

