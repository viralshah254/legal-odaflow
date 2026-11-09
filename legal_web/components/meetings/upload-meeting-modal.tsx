"use client"
import { useTranslations } from "next-intl"

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
import type { ConfidentialityLevel } from "@/lib/types/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { createMeeting, uploadMeetingAudio } from "@/lib/api/meetings"
import { validateUploadFile } from "@/lib/security/validate-upload-file"

interface UploadMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClientId?: string
  initialMatterId?: string
  requireClientSelection?: boolean
  onUploadComplete?: (meetingId: string) => void
}

const NONE_VALUE = "__none__"
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
  const t = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tIssueChecker = useTranslations("issueChecker")
  const tClients = useTranslations("clients")
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const userId = currentUser?.id ?? ""
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clientId, setClientId] = useState(initialClientId ?? "")
  const [matterId, setMatterId] = useState(initialMatterId || NONE_VALUE)
  const [title, setTitle] = useState("")
  const [participants, setParticipants] = useState("")
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>("standard")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: clients = [] } = useApiData(
    ["clients", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId && open },
  )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId && open },
  )

  useEffect(() => {
    if (open && initialClientId) setClientId(initialClientId)
  }, [open, initialClientId])

  const mattersForClient = matters.filter((m) => m.clientId === clientId)
  const client = clients.find((c) => c.id === clientId)
  const canUpload = !!clientId && !!title.trim() && !!file && !!activeTenantId

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setParticipants("")
      setFile(null)
      setFileError(null)
      setMatterId(initialMatterId || NONE_VALUE)
      setClientId(initialClientId ?? "")
      setConfidentiality("standard")
    }
    onOpenChange(next)
  }

  const handleFileSelected = async (next: File | null) => {
    if (!next) {
      setFile(null)
      setFileError(null)
      return
    }
    try {
      await validateUploadFile(next, "meetingAudio")
      setFile(next)
      setFileError(null)
    } catch (err) {
      setFile(null)
      setFileError(err instanceof Error ? err.message : "Unsupported file type")
    }
  }

  const handleUpload = async () => {
    if (!canUpload || !file || !activeTenantId) return
    setUploading(true)
    try {
      await validateUploadFile(file, "meetingAudio")
      const meeting = await createMeeting(activeTenantId, {
        clientId,
        matterId: matterId && matterId !== NONE_VALUE ? matterId : undefined,
        title: title.trim(),
        scheduledAt: new Date().toISOString(),
        participants: participants.split(/[\n,;]/).map((p) => p.trim()).filter(Boolean),
        source: "upload",
        confidentiality,
      })
      // Upload the actual file and trigger async transcription
      await uploadMeetingAudio(activeTenantId, meeting.id, file, 0)
      setUploading(false)
      handleOpenChange(false)
      onUploadComplete?.(meeting.id)
    } catch {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("upload_recording")}</DialogTitle>
          <DialogDescription>
            Upload an audio or video file (.mp3, .m4a, .wav, .mp4). We&apos;ll generate a transcript and smart notes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {requireClientSelection && (
            <>
              <div className="grid gap-2">
                <Label>{tBilling("client")}</Label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setMatterId(NONE_VALUE) }}>
                  <SelectTrigger>
                    <SelectValue placeholder={tClients("selectClient")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {clientId && (
                <div className="grid gap-2">
                  <Label>{t("matter_optional_2")}</Label>
                  <Select value={matterId || NONE_VALUE} onValueChange={setMatterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_matter")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>{tAdmin("none")}</SelectItem>
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
            <p className="text-sm text-muted-foreground">{tIssueChecker("client")}<span className="font-medium text-foreground">{client?.name ?? initialClientId}</span>
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="upload-title">{t("meeting_title")}</Label>
            <Input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("eg_client_call_22_feb_2025")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("file")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? file.name : "Choose file"}
            </Button>
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="upload-participants">{t("participants_optional")}</Label>
            <Textarea
              id="upload-participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder={t("names_or_emails")}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("confidentiality")}</Label>
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
