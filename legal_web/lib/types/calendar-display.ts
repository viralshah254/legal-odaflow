export interface CalendarDisplayEvent {
  id: string
  title: string
  description?: string
  startAt: Date
  endAt?: Date
  type?: "Meeting" | "Hearing" | "Deadline" | "Appointment" | "Other"
  location?: string
  attendeeNames?: string[]
  matterId?: string
  matterTitle?: string
  clientId?: string
  clientName?: string
  taskId?: string
}
