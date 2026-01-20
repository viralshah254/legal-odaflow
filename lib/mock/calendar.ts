export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startAt: Date
  endAt: Date
  matterId?: string
  matterTitle?: string
  attendeeIds: string[]
  attendeeNames: string[]
  location?: string
  type: "Meeting" | "Hearing" | "Deadline" | "Appointment" | "Other"
}

export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "Client meeting - Acme Corp",
    description: "M&A transaction discussion",
    startAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
    matterId: "m1",
    matterTitle: "Acme Corp - M&A Transaction",
    attendeeIds: ["1", "3"],
    attendeeNames: ["Sarah Johnson", "Emily Rodriguez"],
    location: "Conference Room A",
    type: "Meeting",
  },
  {
    id: "e2",
    title: "Court hearing - Smith vs. Jones",
    description: "Motion hearing",
    startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
    matterId: "m2",
    matterTitle: "Smith vs. Jones - Contract Dispute",
    attendeeIds: ["4"],
    attendeeNames: ["David Kim"],
    location: "Courtroom 3",
    type: "Hearing",
  },
  {
    id: "e3",
    title: "Trust document filing deadline",
    description: "Estate Planning matter",
    startAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    matterId: "m4",
    matterTitle: "Estate Planning - Johnson Family Trust",
    attendeeIds: ["3"],
    attendeeNames: ["Emily Rodriguez"],
    type: "Deadline",
  },
  {
    id: "e4",
    title: "Team standup",
    description: "Daily team sync",
    startAt: new Date(Date.now() + 9 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 9 * 30 * 60 * 1000),
    attendeeIds: ["1", "2", "3", "5"],
    attendeeNames: ["Sarah Johnson", "Michael Chen", "Emily Rodriguez", "Lisa Wang"],
    location: "Conference Room B",
    type: "Meeting",
  },
  {
    id: "e5",
    title: "Client consultation - TechStart",
    description: "Series B funding discussion",
    startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
    matterId: "m3",
    matterTitle: "TechStart Inc - Series B Funding",
    attendeeIds: ["2"],
    attendeeNames: ["Michael Chen"],
    location: "Client Office",
    type: "Appointment",
  },
]

export function getEventById(id: string): CalendarEvent | undefined {
  return mockCalendarEvents.find((e) => e.id === id)
}

export function getEventsByAttendee(attendeeId: string): CalendarEvent[] {
  return mockCalendarEvents.filter((e) => e.attendeeIds.includes(attendeeId))
}

export function getUpcomingEvents(days: number = 7): CalendarEvent[] {
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + days)
  return mockCalendarEvents
    .filter((e) => e.startAt >= now && e.startAt <= future)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

export function getNext3Events(): CalendarEvent[] {
  return getUpcomingEvents(7).slice(0, 3)
}

