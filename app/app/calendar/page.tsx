"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useSearchParams } from "next/navigation"
import { CalendarView } from "@/components/calendar/calendar-view"
import { CreateEventDialog } from "@/components/calendar/create-event-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Users, FileText, X } from "lucide-react"
import { format } from "date-fns"
import { getEventsByAttendee, getUpcomingEvents, createEvent, getEventById, mockCalendarEvents, CalendarEvent } from "@/lib/mock/calendar"
import { mockUsers } from "@/lib/mock/users"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function CalendarContent() {
  const { currentRole, currentUser } = useRole()
  const searchParams = useSearchParams()
  const eventId = searchParams.get("event")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]

  // Get events based on role
  const events = useMemo(() => {
    if (currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER") {
      // Partners can see all events
      return mockCalendarEvents
    } else {
      // Others see only their events
      return getEventsByAttendee(user.id)
    }
  }, [currentRole, user.id])

  const handleCreateEvent = (eventData: Omit<CalendarEvent, "id">) => {
    createEvent(eventData)
    setCreateDialogOpen(false)
    // Force re-render by reloading (in a real app, this would be handled by state management)
    window.location.reload()
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCreateDialogOpen(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  // Get event from URL if present
  useEffect(() => {
    if (eventId) {
      const urlEvent = getEventById(eventId)
      if (urlEvent) {
        setSelectedEvent(urlEvent)
      }
    }
  }, [eventId])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">View and manage your schedule</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Calendar View */}
      <CalendarView
        events={events}
        onDateClick={handleDateClick}
        onEventClick={handleEventClick}
      />

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                  <DialogDescription className="mt-2">
                    <Badge variant="outline" className="mr-2">
                      {selectedEvent.type}
                    </Badge>
                    {selectedEvent.matterTitle && (
                      <Link href={`/app/matters/${selectedEvent.matterId}`} className="text-primary hover:underline">
                        {selectedEvent.matterTitle}
                      </Link>
                    )}
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedEvent(null)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedEvent.description && (
                <div>
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">
                      {format(selectedEvent.startAt, "EEEE, MMMM d, yyyy")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(selectedEvent.startAt, "h:mm a")} - {format(selectedEvent.endAt, "h:mm a")}
                    </div>
                  </div>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Location</div>
                      <div className="text-sm text-muted-foreground">{selectedEvent.location}</div>
                    </div>
                  </div>
                )}
                {selectedEvent.attendeeNames.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Attendees</div>
                      <div className="text-sm text-muted-foreground">{selectedEvent.attendeeNames.join(", ")}</div>
                    </div>
                  </div>
                )}
                {selectedEvent.clientId && (
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Client</div>
                      <Link
                        href={`/app/clients/${selectedEvent.clientId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {selectedEvent.clientName}
                      </Link>
                    </div>
                  </div>
                )}
                {selectedEvent.matterId && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Related Matter</div>
                      <Link
                        href={`/app/matters/${selectedEvent.matterId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {selectedEvent.matterTitle}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={selectedDate || undefined}
        onSave={handleCreateEvent}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All scheduled events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getUpcomingEvents(7).filter((e) => events.includes(e)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Events in next 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter((e) => {
                const today = new Date()
                return (
                  format(e.startAt, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
                )
              }).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Events scheduled today</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading calendar...</div>
      </div>
    }>
      <CalendarContent />
    </Suspense>
  )
}
