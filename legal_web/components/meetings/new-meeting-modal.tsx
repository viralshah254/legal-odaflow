"use client"
import { useTranslations } from "next-intl"

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
import { Switch } from "@/components/ui/switch"
import { UserPlus } from "lucide-react"
import type { Meeting, ConfidentialityLevel } from "@/lib/types/meetings"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { createMeeting, type ApiMeeting } from "@/lib/api/meetings"
import {
  getMeetingMediaStream,
  isMediaCaptureSupported,
  mediaCaptureErrorMessage,
  stopMediaStream,
} from "@/lib/meetings/media-capture"
import { CreateClientDialog } from "@/components/clients/create-client-dialog"
import { PermissionsBanner } from "@/components/meetings/permissions-banner"
import { useMediaPermissions } from "@/lib/hooks/use-media-permissions"

interface NewMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClientId?: string
  initialMatterId?: string
  requireClientSelection?: boolean
  onStartRecording: (
    meeting: Meeting,
    options?: { includeVideo?: boolean; mediaStream?: MediaStream },
  ) => void
}

const NONE_VALUE = "__none__"

const confidentialityOptions: { value: ConfidentialityLevel; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "restricted", label: "Restricted" },
  { value: "highly_restricted", label: "Highly restricted" },
]

function apiMeetingToMeeting(m: ApiMeeting): Meeting {
  return {
    id: m.id,
    tenantId: m.tenantId,
    clientId: m.clientId ?? "",
    matterId: m.matterId ?? undefined,
    title: m.title,
    description: m.description ?? undefined,
    startAt: m.startAt ? new Date(m.startAt) : new Date(),
    endAt: m.endAt ? new Date(m.endAt) : undefined,
    createdByUserId: m.createdByUserId ?? "",
    participants: m.participants ?? [],
    source: (m.source ?? "manual_recording") as Meeting["source"],
    confidentiality: (m.confidentiality ?? "standard") as ConfidentialityLevel,
    visibilityAllowListUserIds: [],
    status: (m.status ?? "draft") as Meeting["status"],
    tags: m.tags ?? [],
    durationMs: m.durationMs ?? undefined,
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
  }
}

export function NewMeetingModal({
  open,
  onOpenChange,
  initialClientId,
  initialMatterId,
  requireClientSelection = false,
  onStartRecording,
}: NewMeetingModalProps) {
  const t = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tIssueChecker = useTranslations("issueChecker")
  const tClients = useTranslations("clients")
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const userId = currentUser?.id ?? ""

  const [clientId, setClientId] = useState(initialClientId ?? "")
  const [matterId, setMatterId] = useState(initialMatterId || NONE_VALUE)
  const [title, setTitle] = useState("")
  const [participants, setParticipants] = useState("")
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>("standard")
  const [includeVideo, setIncludeVideo] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Client search + create dialog state
  const [clientSearch, setClientSearch] = useState("")
  const [createClientOpen, setCreateClientOpen] = useState(false)

  const { micState, cameraState, requestMic, requestCamera } = useMediaPermissions()

  const { data: clients = [] } = useApiData(
    ["clients", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId && open },
  )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId && open },
  )

  const formatMeetingTitle = (clientName: string) => {
    const when = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date())
    return `Client Call — ${clientName} — ${when}`
  }

  useEffect(() => {
    if (open) {
      if (initialClientId) setClientId(initialClientId)
      if (initialMatterId) setMatterId(initialMatterId)
      else setMatterId(NONE_VALUE)
      const activeClientId = initialClientId || clientId
      if (!title && activeClientId) {
        const c = clients.find((x) => x.id === activeClientId)
        setTitle(formatMeetingTitle(c?.name ?? "Meeting"))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialClientId, initialMatterId, clients])

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])
  const mattersForClient = useMemo(
    () => matters.filter((m) => m.clientId === clientId),
    [matters, clientId],
  )

  const filteredClients = useMemo(
    () =>
      clientSearch.trim()
        ? clients.filter((c) =>
            c.name.toLowerCase().includes(clientSearch.toLowerCase()),
          )
        : clients,
    [clients, clientSearch],
  )

  const defaultTitle = useMemo(() => {
    const name = client?.name ?? "Meeting"
    return formatMeetingTitle(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.name])

  const canStart = !!clientId && !!activeTenantId

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setParticipants("")
      setMatterId(initialMatterId || NONE_VALUE)
      setClientId(initialClientId ?? "")
      setConfidentiality("standard")
      setIncludeVideo(false)
      setCreateError(null)
      setClientSearch("")
      setCreateClientOpen(false)
    }
    onOpenChange(next)
  }

  const handleStart = async () => {
    if (!canStart || !clientId || !activeTenantId) return
    if (!isMediaCaptureSupported()) {
      setCreateError("Recording is not supported in this browser. Try Chrome or disable Brave Shields for localhost.")
      return
    }
    setCreating(true)
    setCreateError(null)

    let mediaStream: MediaStream | null = null
    try {
      // Must request mic in the same click handler — browsers block getUserMedia after async gaps.
      mediaStream = await getMeetingMediaStream(includeVideo)
    } catch (e) {
      setCreateError(mediaCaptureErrorMessage(includeVideo, e))
      setCreating(false)
      return
    }

    try {
      const created = await createMeeting(activeTenantId, {
        clientId,
        matterId: matterId && matterId !== NONE_VALUE ? matterId : undefined,
        title: title.trim() || defaultTitle,
        scheduledAt: new Date().toISOString(),
        participants: participants
          .split(/[\n,;]/)
          .map((p) => p.trim())
          .filter(Boolean),
        source: "manual_recording",
        status: "recording",
        confidentiality,
      })
      handleOpenChange(false)
      onStartRecording(
        apiMeetingToMeeting({ ...created, createdByUserId: userId || created.createdByUserId }),
        { includeVideo, mediaStream },
      )
    } catch (e) {
      stopMediaStream(mediaStream)
      setCreateError(e instanceof Error ? e.message : "Failed to start recording")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("new_meeting_recording")}</DialogTitle>
          <DialogDescription>
            Start an in-app recording. You can also join a Zoom or Teams call in another window—we'll capture your microphone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {requireClientSelection && (
            <>
              <div className="grid gap-2">
                <Label>{tBilling("client")}</Label>
                <Input
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="mb-0.5"
                />
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setMatterId(NONE_VALUE) }}>
                  <SelectTrigger>
                    <SelectValue placeholder={tClients("selectClient")} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No clients found
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs justify-start px-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setCreateClientOpen(true)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Add new client
                </Button>
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
            <>
              <p className="text-sm text-muted-foreground">{tIssueChecker("client")}<span className="font-medium text-foreground">{client?.name ?? initialClientId}</span>
              </p>
              {mattersForClient.length > 0 && (
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
          <div className="grid gap-2">
            <Label htmlFor="title">{t("meeting_title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="participants">{t("participants_optional")}</Label>
            <Textarea
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder={t("names_or_emails_one_per_line_or_comma-separated")}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("confidentiality")}</Label>
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
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="include-video" className="text-sm font-medium">
                Include camera
              </Label>
              <p className="text-xs text-muted-foreground">
                Record video with your microphone. Your browser will ask for camera access.
              </p>
            </div>
            <Switch
              id="include-video"
              checked={includeVideo}
              onCheckedChange={setIncludeVideo}
            />
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground/80">Live transcription</p>
            <p>Real-time captions use ~2 credits/min while recording. AI notes are generated on save.</p>
          </div>
        </div>
        <PermissionsBanner
          micState={micState}
          cameraState={cameraState}
          includeVideo={includeVideo}
          onRequestMic={requestMic}
          onRequestCamera={requestCamera}
        />
        {createError && (
          <p className="text-sm text-destructive px-1 -mt-2">{createError}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={!canStart || creating || micState === "denied"}
            title={micState === "denied" ? "Microphone access is blocked — allow it above first" : undefined}
          >
            {creating ? "Creating…" : "Start recording"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CreateClientDialog
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        onCreated={(c) => {
          setClientId(c.id)
          setMatterId(NONE_VALUE)
          if (!title) setTitle(formatMeetingTitle(c.name))
          setCreateClientOpen(false)
        }}
      />
    </Dialog>
  )
}
