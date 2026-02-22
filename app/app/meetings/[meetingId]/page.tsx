"use client"

import { use, useState } from "react"
import Link from "next/link"
import { getMeetingById, getTranscriptByMeetingId, getNotesByMeetingId, getEventsByMeetingId } from "@/lib/mock/meetings"
import { getClientById } from "@/lib/mock/clients"
import { getMatterById } from "@/lib/mock/matters"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MeetingStatusChip } from "@/components/meetings/meeting-status-chip"
import { MeetingSecurityBadge } from "@/components/meetings/meeting-security-badge"
import { ArrowLeft, FileText, List, Clock, User } from "lucide-react"
import { notFound } from "next/navigation"

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }> | { meetingId: string }
}) {
  const meetingId = params instanceof Promise ? use(params).meetingId : params.meetingId
  const meeting = getMeetingById(meetingId)
  const transcript = getTranscriptByMeetingId(meetingId)
  const notes = getNotesByMeetingId(meetingId)
  const events = getEventsByMeetingId(meetingId)

  if (!meeting) notFound()

  const client = getClientById(meeting.clientId)
  const matter = meeting.matterId ? getMatterById(meeting.matterId) : null

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={client ? `/app/clients/${meeting.clientId}` : "/app/dashboard"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{meeting.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <MeetingStatusChip status={meeting.status} />
            <MeetingSecurityBadge level={meeting.confidentiality} />
            {client && (
              <Link href={`/app/clients/${meeting.clientId}`} className="text-sm text-muted-foreground hover:underline">
                {client.name}
              </Link>
            )}
            {matter && (
              <Link href={`/app/matters/${meeting.matterId}`} className="text-sm text-muted-foreground hover:underline">
                {matter.title}
              </Link>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="transcript" className="w-full">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="notes">Smart notes</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transcript
              </CardTitle>
              <CardDescription>
                {meeting.status === "ready" && transcript
                  ? "Speaker-labeled transcript with timestamps."
                  : meeting.status === "processing"
                    ? "Transcript is being generated…"
                    : "No transcript yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meeting.status === "processing" && (
                <p className="text-sm text-muted-foreground">Processing… This usually takes a minute.</p>
              )}
              {meeting.status === "ready" && transcript && (
                <div className="space-y-4">
                  {transcript.segments.map((seg, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground w-14">
                        {formatTime(seg.startMs)}
                      </span>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">{seg.speakerLabel}</span>
                        <p className="text-sm mt-0.5">{seg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {meeting.status === "ready" && !transcript && (
                <p className="text-sm text-muted-foreground">No transcript available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Smart notes
              </CardTitle>
              <CardDescription>Summary, decisions, and action items from the meeting.</CardDescription>
            </CardHeader>
            <CardContent>
              {notes ? (
                <div className="space-y-6">
                  <Section title="Attendees" items={notes.attendees} />
                  <Section title="Agenda" items={notes.agenda} />
                  <Section title="Summary" items={notes.summaryBullets} />
                  <Section title="Decisions" items={notes.decisions} />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Action items</h4>
                    <ul className="space-y-2">
                      {notes.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-primary" />
                          <span>{item.text}</span>
                          {item.dueDate && (
                            <span className="text-muted-foreground">
                              Due {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Section title="Risks" items={notes.risks} />
                  <Section title="Open questions" items={notes.openQuestions} />
                  {notes.followUpEmailDraft && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Follow-up email draft</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes.followUpEmailDraft}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {meeting.status === "processing" ? "Notes are being generated…" : "No notes yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Audit
              </CardTitle>
              <CardDescription>Actions taken on this meeting.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{e.eventType}</span>
                    <span className="text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
