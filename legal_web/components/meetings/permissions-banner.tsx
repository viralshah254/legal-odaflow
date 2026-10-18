"use client"

import { CheckCircle2, AlertTriangle, Mic, Video, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PermissionState } from "@/lib/hooks/use-media-permissions"

interface PermissionRowProps {
  label: string
  state: PermissionState
  onRequest: () => Promise<void>
  icon: React.ReactNode
}

function PermissionRow({ label, state, onRequest, icon }: PermissionRowProps) {
  if (state === "unsupported") return null

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {state === "granted" && (
        <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Allowed
        </div>
      )}
      {state === "prompt" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={onRequest}
        >
          Allow
        </Button>
      )}
      {state === "denied" && (
        <div className="flex items-center gap-1 text-xs text-destructive font-medium">
          <XCircle className="h-3.5 w-3.5" />
          Blocked
        </div>
      )}
    </div>
  )
}

interface PermissionsBannerProps {
  micState: PermissionState
  cameraState: PermissionState
  includeVideo: boolean
  onRequestMic: () => Promise<void>
  onRequestCamera: () => Promise<void>
  className?: string
}

export function PermissionsBanner({
  micState,
  cameraState,
  includeVideo,
  onRequestMic,
  onRequestCamera,
  className,
}: PermissionsBannerProps) {
  const micDenied = micState === "denied"
  const cameraDenied = includeVideo && cameraState === "denied"
  const hasIssue = micDenied || cameraDenied

  // Hide when mic is allowed (or uncheckable) and camera is not required or also allowed
  const micOk = micState === "granted" || micState === "unsupported"
  const cameraOk = !includeVideo || cameraState === "granted" || cameraState === "unsupported"
  if (micOk && cameraOk) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 space-y-2",
        hasIssue ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30",
        className,
      )}
    >
      {hasIssue && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive leading-snug">
            {micDenied
              ? "Microphone access is blocked. Open your browser's site settings or System Settings → Privacy → Microphone and allow this site."
              : "Camera access is blocked. Check System Settings → Privacy → Camera."}
          </p>
        </div>
      )}
      <PermissionRow
        label="Microphone"
        state={micState}
        onRequest={onRequestMic}
        icon={<Mic className="h-3.5 w-3.5" />}
      />
      {includeVideo && (
        <PermissionRow
          label="Camera"
          state={cameraState}
          onRequest={onRequestCamera}
          icon={<Video className="h-3.5 w-3.5" />}
        />
      )}
    </div>
  )
}
