"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Scale } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface CorrectionSignal {
  id: string
  countryCode: string
  queryFingerprint: string
  wrongSection: string
  correctSection: string
  primarySourceAuthorityId: string | null
  supportingCaseIds: string[]
  aiOutputId: string | null
  confidence: number
  status: "pending" | "approved" | "rejected"
  reviewNotes: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  createdAt: string
}

interface ListResponse {
  total: number
  items: CorrectionSignal[]
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof ShieldCheck }> = {
  pending: { label: "Pending Review", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertTriangle },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums">{pct}%</span>
    </div>
  )
}

function SignalCard({
  signal,
  onApprove,
  onReject,
  reviewing,
}: {
  signal: CorrectionSignal
  onApprove: (id: string, notes: string) => void
  onReject: (id: string, notes: string) => void
  reviewing: string | null
}) {
  const [notes, setNotes] = useState("")
  const meta = STATUS_META[signal.status] ?? STATUS_META.pending
  const Icon = meta.icon

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4 bg-muted/20 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Section Correction Signal</CardTitle>
            <Badge variant="outline" className="text-xs">{signal.countryCode}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium", meta.cls)}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="text-xs text-muted-foreground">{new Date(signal.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-4 space-y-4 text-sm">
        {/* Section change */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-1.5">
            <p className="text-xs text-muted-foreground mb-0.5">AI cited (wrong)</p>
            <p className="font-mono font-semibold text-red-700 dark:text-red-400">{signal.wrongSection}</p>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
            <p className="text-xs text-muted-foreground mb-0.5">Correction (suggested)</p>
            <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{signal.correctSection}</p>
          </div>
        </div>

        {/* Confidence */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Confidence (similar-case frequency)</p>
          <ConfidenceBar confidence={signal.confidence} />
        </div>

        {/* Supporting cases count */}
        {Array.isArray(signal.supportingCaseIds) && signal.supportingCaseIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {signal.supportingCaseIds.length} similar case(s) supported this correction.
          </p>
        )}

        {/* Primary source */}
        {signal.primarySourceAuthorityId && (
          <p className="text-xs text-muted-foreground">
            Primary-law confirmation authority ID: <span className="font-mono">{signal.primarySourceAuthorityId}</span>
          </p>
        )}

        {/* Query fingerprint */}
        <p className="text-xs text-muted-foreground">
          Query fingerprint: <span className="font-mono">{signal.queryFingerprint}</span>
        </p>

        {/* Reviewer notes if already reviewed */}
        {signal.reviewNotes && (
          <div className="rounded-md bg-muted/30 border px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Review notes</p>
            <p>{signal.reviewNotes}</p>
          </div>
        )}

        {/* Review actions — only for pending */}
        {signal.status === "pending" && (
          <div className="space-y-2 pt-1 border-t">
            <Textarea
              rows={2}
              placeholder="Optional review notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={reviewing === signal.id}
                onClick={() => onApprove(signal.id, notes)}
              >
                {reviewing === signal.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={reviewing === signal.id}
                onClick={() => onReject(signal.id, notes)}
              >
                {reviewing === signal.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResearchCorrectionsPage() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("pending")
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [toast, setToast] = useState("")

  const load = (s = status) => {
    setLoading(true)
    apiFetch<ListResponse>(`/admin/research-corrections?status=${s}&limit=50`)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStatusChange = (s: string) => {
    setStatus(s)
    load(s)
  }

  const handleApprove = async (id: string, notes: string) => {
    setReviewing(id)
    try {
      await apiFetch(`/admin/research-corrections/${id}/approve`, {
        method: "PATCH",
        body: { reviewNotes: notes || undefined },
      })
      setToast("Correction approved — it will now influence future research.")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve")
    } finally {
      setReviewing(null)
      setTimeout(() => setToast(""), 4000)
    }
  }

  const handleReject = async (id: string, notes: string) => {
    setReviewing(id)
    try {
      await apiFetch(`/admin/research-corrections/${id}/reject`, {
        method: "PATCH",
        body: { reviewNotes: notes || undefined },
      })
      setToast("Correction rejected — it will not influence future research.")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject")
    } finally {
      setReviewing(null)
      setTimeout(() => setToast(""), 4000)
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Research Accuracy Review</h1>
          <p className="text-sm text-muted-foreground">
            Review AI-detected statute section corrections found via similar-case cross-check.
            Approved corrections will influence future research answers. Super Admin access only.
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Status</p>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground">{data.total} signal(s)</span>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Explanation note */}
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <p className="font-semibold">How this works</p>
        <p>
          When AI research cites a statute section that similar cases consistently disagree with, and primary-law lookup confirms an alternative, the system creates a pending signal here.
          <strong className="ml-1">Approving</strong> a signal boosts the correct section in future retrieval and adds a caution to the prompt.
          <strong className="ml-1">Rejecting</strong> prevents it from influencing research.
          Static curated data is never automatically modified — only a code update can do that.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data?.items.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          No {status} correction signals.
        </div>
      ) : (
        <div className="space-y-4">
          {data?.items.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onApprove={(id, notes) => void handleApprove(id, notes)}
              onReject={(id, notes) => void handleReject(id, notes)}
              reviewing={reviewing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
