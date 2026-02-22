"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { mockClients } from "@/lib/mock/clients"
import { mockMatters } from "@/lib/mock/matters"
import type { Meeting, ConfidentialityLevel } from "@/lib/types/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { createMeeting } from "@/lib/mock/meetings"

interface NewMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When from client page, pass client so we don't ask for it */
  initialClientId?: string
  /** Optional pre-selected matter */
  initialMatterId?: string
  /** When true (e.g. from dashboard), show client and matter selectors */
  requireClientSelection?: boolean
  onStartRecording: (meeting: Meeting) => void
}

const confidentialityOptions: { value: ConfidentialityLevel; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "restricted", label: "Restricted" },
  { value: "highly_restricted", label: "Highly restricted" },
]

export function NewMeetingModal({
  open,
  onOpenChange,
  initialClientId,
  initialMatterId,
  requireClientSelection = false,
  onStartRecording,
}: NewMeetingModalProps) {
  const { currentUser } = useRole()
  const userId = currentUser?.id ?? "1"

  const [clientId, setClientId] = useState(initialClientId ?? "")
  const [matterId, setMatterId] = useState(initialMatterId ?? "")
  const [title, setTitle] = useState("")
  const [participants, setParticipants] = useState("")
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>("standard")

  useEffect(() => {
    if (open) {
      if (initialClientId) setClientId(initialClientId)
      if (initialMatterId) setMatterId(initialMatterId)
      if (!title && (initialClientId || clientId)) {
        const c = mockClients.find((x) => x.id === (initialClientId || clientId))
        setTitle(`Client Call — ${c?.name ?? "Meeting"} — ${new Date().toLocaleDateString()}`)
      }
    }
  }, [open, initialClientId, initialMatterId])

  const client = useMemo(() => mockClients.find((c) => c.id === clientId), [clientId])
  const mattersForClient = useMemo(
    () => mockMatters.filter((m) => m.clientId === clientId),
    [clientId]
  )

  const defaultTitle = useMemo(() => {
    const today = new Date().toLocaleDateString()
    const name = client?.name ?? "Meeting"
    return `Client Call — ${name} — ${today}`
  }, [client?.name])

  const canStart = !!clientId

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setParticipants("")
      setMatterId(initialMatterId ?? "")
      setClientId(initialClientId ?? "")
      setConfidentiality("standard")
    }
    onOpenChange(next)
  }

  const handleStart = () => {
    if (!canStart || !clientId) return
    const meeting = createMeeting({
      clientId,
      matterId: matterId || undefined,
      title: title.trim() || defaultTitle,
      participants: participants
        .split(/[\n,;]/)
        .map((p) => p.trim())
        .filter(Boolean),
      confidentiality,
      createdByUserId: userId,
      source: "manual_recording",
    })
    handleOpenChange(false)
    onStartRecording(meeting)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New meeting recording</DialogTitle>
          <DialogDescription>
            Start an in-app recording. You can also join a Zoom or Teams call in another window—we’ll capture your microphone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {requireClientSelection && (
            <>
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setMatterId("") }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mattersForClient.length > 0 && (
                <div className="grid gap-2">
                  <Label>Matter (optional)</Label>
                  <Select value={matterId} onValueChange={setMatterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select matter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {mattersForClient.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {initialClientId && !requireClientSelection && (
            <p className="text-sm text-muted-foreground">
              Client: <span className="font-medium text-foreground">{client?.name ?? initialClientId}</span>
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="title">Meeting title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>
          {requireClientSelection && initialMatterId && (
            <div className="grid gap-2">
              <Label>Matter (optional)</Label>
              <Select value={matterId} onValueChange={setMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select matter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {mattersForClient.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="participants">Participants (optional)</Label>
            <Textarea
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Names or emails, one per line or comma-separated"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Confidentiality</Label>
            <Select
              value={confidentiality}
              onValueChange={(v) => setConfidentiality(v as ConfidentialityLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {confidentialityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!canStart}>
            Start recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
