import { TimelineEvent, TimelineEventType } from "@/lib/types/timeline"

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: "tl1",
    matterId: "m1",
    type: "MATTER_CREATED",
    title: "Matter created",
    description: "Acme Corp - M&A Transaction",
    userId: "1",
    userName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "tl2",
    matterId: "m1",
    type: "STAGE_CHANGED",
    title: "Stage changed",
    description: "From Active to Negotiation",
    userId: "1",
    userName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    metadata: { from: "Active", to: "Negotiation" },
  },
  {
    id: "tl3",
    matterId: "m2",
    type: "ASSISTANCE_GRANTED",
    title: "Assistance granted",
    description: "Sarah Johnson granted assistance to David Kim",
    userId: "1",
    userName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    metadata: { helperId: "4", helperName: "David Kim" },
  },
]

export function getTimelineEventsByMatter(matterId: string): TimelineEvent[] {
  return mockTimelineEvents
    .filter((e) => e.matterId === matterId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function addTimelineEvent(event: Omit<TimelineEvent, "id">): TimelineEvent {
  const newEvent: TimelineEvent = {
    ...event,
    id: `tl-${Date.now()}`,
  }
  mockTimelineEvents.push(newEvent)
  return newEvent
}




