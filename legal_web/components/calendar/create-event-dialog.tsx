"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CalendarDisplayEvent } from "@/lib/types/calendar-display"
import type { CreateCalendarEventRequest } from "@/lib/api/calendar"
import { listMatters } from "@/lib/api/matters"
import { listClients } from "@/lib/api/clients"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { format } from "date-fns"

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onSave: (event: CreateCalendarEventRequest) => void
}

export function CreateEventDialog({ open, onOpenChange, initialDate, onSave }: CreateEventDialogProps) {
  const t = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const tBilling = useTranslations("billing")
  const { activeTenantId } = useTenant()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<NonNullable<CalendarDisplayEvent["type"]>>("Meeting")
  const [clientId, setClientId] = useState<string>("")
  const [startDate, setStartDate] = useState(initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
  const [startTime, setStartTime] = useState(initialDate ? format(initialDate, "HH:mm") : "09:00")
  const [endDate, setEndDate] = useState(initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
  const [endTime, setEndTime] = useState(initialDate ? format(new Date(initialDate.getTime() + 60 * 60 * 1000), "HH:mm") : "10:00")
  const [location, setLocation] = useState("")
  const [matterId, setMatterId] = useState("")
  const [matterTitle, setMatterTitle] = useState("")
  const [matterSearch, setMatterSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [reminder, setReminder] = useState("30")
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(matterSearch), 300)
    return () => clearTimeout(timer)
  }, [matterSearch])
  const { data: matters = [], error: mattersError, refetch: refetchMatters } = useApiData(
    ["matters-for-event", activeTenantId, clientId, searchQuery],
    { apiFn: () => listMatters(activeTenantId!, { clientId: clientId || undefined, search: searchQuery || undefined, limit: 50 }), enabled: !!activeTenantId && open },
  )

  const { data: clients = [] } = useApiData(
    ["clients-for-event", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId && open },
  )

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
      setMatterId("")
      setMatterTitle("")
      setMatterSearch("")
      setReminder("30")
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

    onSave({
      title,
      description,
      type,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      clientId: clientId && clientId !== "none" ? clientId : undefined,
      location: location || undefined,
      matterId: matterId || undefined,
      reminderMinutes: reminder === "off" ? null : Number(reminder),
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("create_event")}</DialogTitle>
          <DialogDescription>{t("add_a_new_event_to_your_calendar")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("title")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("event_title")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">{tAdmin("type")}</Label>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meeting">{t("meeting")}</SelectItem>
                <SelectItem value="Hearing">{t("hearing")}</SelectItem>
                <SelectItem value="Deadline">{t("deadline")}</SelectItem>
                <SelectItem value="Appointment">{t("appointment")}</SelectItem>
                <SelectItem value="Other">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client">{tBilling("client")}</Label>
            <Select value={clientId || undefined} onValueChange={(value) => { setClientId(value === "none" ? "" : value); setMatterId(""); setMatterTitle("") }}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_a_client_optional")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tAdmin("none")}</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} ({client.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-matter">{t("calendar_linked_matter")}</Label>
            <Input aria-label={t("calendar_search_matters")} placeholder={t("calendar_search_matters")} value={matterSearch} onChange={event => setMatterSearch(event.target.value)} />
            <Select value={matterId || "none"} onValueChange={value => {
              setMatterId(value === "none" ? "" : value)
              const matter = matters.find(item => item.id === value)
              setMatterTitle(matter?.title || "")
              if (matter?.clientId) setClientId(matter.clientId)
            }}>
              <SelectTrigger id="event-matter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tAdmin("none")}</SelectItem>
                {matterId && !matters.some(matter => matter.id === matterId) && <SelectItem value={matterId}>{matterTitle}</SelectItem>}
                {matters.map(matter => <SelectItem key={matter.id} value={matter.id}>{matter.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {mattersError && <Button type="button" variant="ghost" onClick={() => { void refetchMatters() }}>{t("calendar_matters_unavailable")}</Button>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-reminder">{t("calendar_reminder")}</Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger id="event-reminder"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{t("calendar_reminder_off")}</SelectItem>
                <SelectItem value="0">{t("calendar_reminder_at_start")}</SelectItem>
                {[15, 30, 60, 1440].map(minutes => <SelectItem key={minutes} value={String(minutes)}>{t("calendar_reminder_minutes", { minutes })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{tBilling("description")}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("event_description")} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("start_date")}</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">{t("start_time")}</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">{t("end_date")}</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{t("end_time")}</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">{tAdmin("location")}</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("event_location")} />
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
