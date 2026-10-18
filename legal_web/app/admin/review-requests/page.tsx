"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, RefreshCw } from "lucide-react"
import { listAdminReviewRequests, type AdminReviewRequest } from "@/lib/api/admin"

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "PAID", label: "Paid" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "COMPLETED", label: "Completed" },
]

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PAYMENT_PENDING: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  PAID: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ASSIGNED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  IN_REVIEW: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

function statusBadge(status: string) {
  const cls = STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

export default function AdminReviewRequestsPage() {
  const [requests, setRequests] = useState<AdminReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const load = (status?: string) => {
    setLoading(true)
    setError("")
    listAdminReviewRequests({ status: status || undefined })
      .then(setRequests)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const counts = STATUS_OPTIONS.slice(1).reduce(
    (acc, s) => {
      acc[s.value] = requests.filter((r) => r.status === s.value).length
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lawyer Review Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All consumer lawyer review requests across the platform.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(statusFilter)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_OPTIONS.slice(1).map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? "" : s.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {s.label}
              {counts[s.value] ? (
                <span className="ml-1.5 opacity-70">{counts[s.value]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </span>
        </div>

        {error && (
          <Card className="mb-6 border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No review requests found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Left: case info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {statusBadge(req.status)}
                        <Badge variant="outline" className="text-xs">
                          {req.countryCode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="font-semibold text-sm truncate">
                        {req.consumerCase?.title ?? req.issueType}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.issueType}
                        {req.jurisdiction ? ` · ${req.jurisdiction}` : ""}
                      </p>
                      {req.user && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Consumer: {req.user.name ?? req.user.email}{" "}
                          <span className="opacity-60">({req.user.email})</span>
                        </p>
                      )}
                    </div>

                    {/* Right: price + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-sm font-semibold">
                        {req.currency} {Number(req.price).toLocaleString()}
                      </p>
                      {req.consumerCase && (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/consumer/cases/${req.consumerCase.id}/report`}
                            target="_blank"
                          >
                            View case
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
