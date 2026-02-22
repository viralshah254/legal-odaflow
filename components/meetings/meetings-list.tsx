"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Meeting } from "@/lib/types/meetings"
import { getClientById } from "@/lib/mock/clients"
import { getMatterById } from "@/lib/mock/matters"
import { MeetingStatusChip } from "./meeting-status-chip"
import { MeetingSecurityBadge } from "./meeting-security-badge"
import { Search, FileText, Mic, Upload, Video } from "lucide-react"

interface MeetingsListProps {
  meetings: Meeting[]
  clientId?: string
  onRecordClick?: () => void
  onUploadClick?: () => void
  onImportClick?: () => void
  showActions?: boolean
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatDuration(ms?: number) {
  if (ms == null) return "—"
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function MeetingsList({
  meetings,
  clientId,
  onRecordClick,
  onUploadClick,
  onImportClick,
  showActions = true,
}: MeetingsListProps) {
  const [search, setSearch] = useState("")
  const filtered = search.trim()
    ? meetings.filter((m) => {
        const title = m.title.toLowerCase()
        const clientName = getClientById(m.clientId)?.name.toLowerCase() ?? ""
        const q = search.toLowerCase()
        return title.includes(q) || clientName.includes(q)
      })
    : meetings

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Meetings</CardTitle>
            <CardDescription>
              Recordings, transcripts, and meeting notes for {clientId ? "this client" : "all meetings"}.
            </CardDescription>
          </div>
          {showActions && (onRecordClick || onUploadClick || onImportClick) && (
            <div className="flex flex-wrap gap-2">
              {onRecordClick && (
                <Button size="sm" onClick={onRecordClick}>
                  <Mic className="mr-2 h-4 w-4" />
                  Record transcript
                </Button>
              )}
              {onUploadClick && (
                <Button size="sm" variant="outline" onClick={onUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              )}
              {onImportClick && (
                <Button size="sm" variant="outline" onClick={onImportClick}>
                  <Video className="mr-2 h-4 w-4" />
                  Import from Zoom / Meet / Teams
                </Button>
              )}
            </div>
          )}
        </div>
        {meetings.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search meetings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-xs"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No meetings yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record a call, upload a file, or import from Zoom / Meet / Teams.
            </p>
            {showActions && (onRecordClick || onUploadClick) && (
              <div className="mt-4 flex gap-2">
                {onRecordClick && (
                  <Button size="sm" onClick={onRecordClick}>
                    <Mic className="mr-2 h-4 w-4" />
                    Record transcript
                  </Button>
                )}
                {onUploadClick && (
                  <Button size="sm" variant="outline" onClick={onUploadClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((m) => {
              const client = getClientById(m.clientId)
              const matter = m.matterId ? getMatterById(m.matterId) : null
              return (
                <li key={m.id}>
                  <Link
                    href={`/app/meetings/${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        <MeetingStatusChip status={m.status} />
                        <MeetingSecurityBadge level={m.confidentiality} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-sm text-muted-foreground">
                        <span>{client?.name ?? m.clientId}</span>
                        {matter && <span>{matter.title}</span>}
                        <span>{formatDate(m.startAt)}</span>
                        {m.durationMs != null && <span>{formatDuration(m.durationMs)}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <span>View</span>
                    </Button>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

