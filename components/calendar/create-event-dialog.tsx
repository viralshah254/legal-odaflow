"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarEvent } from "@/lib/mock/calendar"
import { mockClients } from "@/lib/mock/clients"
import { format } from "date-fns"

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onSave: (event: Omit<CalendarEvent, "id">) => void
}

export function CreateEventDialog({ open, onOpenChange, initialDate, onSave }: CreateEventDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<CalendarEvent["type"]>("Meeting")
  const [clientId, setClientId] = useState<string>("")
  const [startDate, setStartDate] = useState(initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
  const [startTime, setStartTime] = useState(initialDate ? format(initialDate, "HH:mm") : "09:00")
  const [endDate, setEndDate] = useState(initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
  const [endTime, setEndTime] = useState(initialDate ? format(new Date(initialDate.getTime() + 60 * 60 * 1000), "HH:mm") : "10:00")
  const [location, setLocation] = useState("")

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("")
      setDescription("")
      setType("Meeting")
      setClientId("")
      setStartDate(format(new Date(), "yyyy-MM-dd"))
      setStartTime("09:00")
      setEndDate(format(new Date(), "yyyy-MM-dd"))
      setEndTime("10:00")
      setLocation("")
    } else if (initialDate) {
      setStartDate(format(initialDate, "yyyy-MM-dd"))
      setEndDate(format(initialDate, "yyyy-MM-dd"))
    }
  }, [open, initialDate])

  const handleSave = () => {
    const startAt = new Date(`${startDate}T${startTime}`)
    const endAt = new Date(`${endDate}T${endTime}`)

    if (!title || startAt >= endAt) {
      return
    }

    const selectedClient = clientId && clientId !== "none" ? mockClients.find((c) => c.id === clientId) : null

    onSave({
      title,
      description,
      type,
      startAt,
      endAt,
      clientId: clientId && clientId !== "none" ? clientId : undefined,
      clientName: selectedClient?.name,
      location: location || undefined,
      attendeeIds: [],
      attendeeNames: [],
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>Add a new event to your calendar</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as CalendarEvent["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Hearing">Hearing</SelectItem>
                <SelectItem value="Deadline">Deadline</SelectItem>
                <SelectItem value="Appointment">Appointment</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={clientId || undefined} onValueChange={(value) => setClientId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {mockClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} ({client.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Event description" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Event location" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title}>
            Create Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

