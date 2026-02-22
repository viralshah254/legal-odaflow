"use client"

import { useState, useRef, useEffect } from "react"
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
import type { ConfidentialityLevel } from "@/lib/types/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { createMeeting, updateMeetingStatus } from "@/lib/mock/meetings"

interface UploadMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClientId?: string
  initialMatterId?: string
  requireClientSelection?: boolean
  onUploadComplete?: (meetingId: string) => void
}

const ACCEPT = ".mp3,.m4a,.wav,.mp4,.webm"
const confidentialityOptions: { value: ConfidentialityLevel; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "restricted", label: "Restricted" },
  { value: "highly_restricted", label: "Highly restricted" },
]

export function UploadMeetingModal({
  open,
  onOpenChange,
  initialClientId,
  initialMatterId,
  requireClientSelection = false,
  onUploadComplete,
}: UploadMeetingModalProps) {
  const { currentUser } = useRole()
  const userId = currentUser?.id ?? "1"
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clientId, setClientId] = useState(initialClientId ?? "")
  const [matterId, setMatterId] = useState(initialMatterId ?? "")
  const [title, setTitle] = useState("")
  const [participants, setParticipants] = useState("")
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>("standard")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open && initialClientId) setClientId(initialClientId)
  }, [open, initialClientId])

  const mattersForClient = mockMatters.filter((m) => m.clientId === clientId)
  const client = mockClients.find((c) => c.id === clientId)
  const canUpload = !!clientId && !!title.trim() && !!file

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setParticipants("")
      setFile(null)
      setMatterId(initialMatterId ?? "")
      setClientId(initialClientId ?? "")
      setConfidentiality("standard")
    }
    onOpenChange(next)
  }

  const handleUpload = async () => {
    if (!canUpload || !file) return
    setUploading(true)
    try {
      const meeting = createMeeting({
        clientId,
        matterId: matterId || undefined,
        title: title.trim(),
        participants: participants.split(/[\n,;]/).map((p) => p.trim()).filter(Boolean),
        confidentiality,
        createdByUserId: userId,
        source: "upload",
      })
      updateMeetingStatus(meeting.id, "processing")
      setTimeout(() => {
        const durationMs = 120000
        updateMeetingStatus(meeting.id, "ready", { durationMs })
        setUploading(false)
        handleOpenChange(false)
        onUploadComplete?.(meeting.id)
      }, 2000)
    } catch {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Upload recording</DialogTitle>
          <DialogDescription>
            Upload an audio or video file (.mp3, .m4a, .wav, .mp4). We’ll generate a transcript and smart notes.
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
            <Label htmlFor="upload-title">Meeting title</Label>
            <Input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client call — 22 Feb 2025"
            />
          </div>
          <div className="grid gap-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? file.name : "Choose file"}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="upload-participants">Participants (optional)</Label>
            <Textarea
              id="upload-participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Names or emails"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Confidentiality</Label>
            <Select value={confidentiality} onValueChange={(v) => setConfidentiality(v as ConfidentialityLevel)}>
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
          <Button onClick={handleUpload} disabled={!canUpload || uploading}>
            {uploading ? "Processing…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
