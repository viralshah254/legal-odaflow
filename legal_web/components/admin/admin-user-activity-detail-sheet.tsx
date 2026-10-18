"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  getAdminUserActivityDetail,
  type AdminActivityCategory,
  type AdminUserActivityDetail,
} from "@/lib/api/admin-extended"
import { Loader2 } from "lucide-react"

const CATEGORY_STYLES: Record<AdminActivityCategory, string> = {
  research: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  drafting: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  copilot: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  search: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  other: "bg-muted text-muted-foreground",
}

interface Props {
  activityId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminUserActivityDetailSheet({ activityId, open, onOpenChange }: Props) {
  const [detail, setDetail] = useState<AdminUserActivityDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !activityId) {
      setDetail(null)
      setError("")
      return
    }
    let cancelled = false
    setLoading(true)
    setError("")
    getAdminUserActivityDetail(activityId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, activityId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive mt-8">{error}</p>
        ) : detail ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                {detail.userName ?? detail.userEmail ?? "Unknown user"}
                <Badge className={`text-xs border-0 ${CATEGORY_STYLES[detail.category]}`}>
                  {detail.category}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {detail.userEmail ?? "—"}
                {detail.tenantName ? ` · ${detail.tenantName}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Context
                </h3>
                <dl className="text-sm space-y-1.5">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">Task</dt>
                    <dd>{detail.taskType ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">Mode</dt>
                    <dd>{detail.mode ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">Source</dt>
                    <dd>{detail.source}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">When</dt>
                    <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                  </div>
                  {detail.metadata?.jurisdiction ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-24 shrink-0">Jurisdiction</dt>
                      <dd>{detail.metadata.jurisdiction}</dd>
                    </div>
                  ) : null}
                  {detail.metadata?.matterId ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-24 shrink-0">Matter</dt>
                      <dd className="font-mono text-xs break-all">{detail.metadata.matterId}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Prompt
                </h3>
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 text-sm max-h-[40vh] overflow-y-auto">
                  {detail.prompt || "(empty)"}
                </pre>
              </section>

              {detail.output != null && detail.output !== "" ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Output
                  </h3>
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 text-sm max-h-[50vh] overflow-y-auto">
                    {detail.output}
                  </pre>
                </section>
              ) : null}

              {detail.copilotThread && detail.copilotThread.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Full thread ({detail.copilotThread.length} messages)
                  </h3>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {detail.copilotThread.map((m, i) => (
                      <div
                        key={`${m.role}-${i}-${m.createdAt}`}
                        className={`rounded-lg border p-3 text-sm ${
                          m.role === "user"
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">
                            {m.role}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                          {m.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
