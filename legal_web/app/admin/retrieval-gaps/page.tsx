"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Play, RefreshCw } from "lucide-react"
import {
  getRetrievalGapStats,
  listRetrievalGaps,
  triggerRetrievalGapIngest,
  updateRetrievalGap,
  type ResearchRetrievalGap,
  type RetrievalGapIngestResult,
  type RetrievalGapStats,
  type RetrievalGapType,
} from "@/lib/api/admin"

const PAGE_SIZE = 50
const STATUSES = ["", "open", "in_progress", "resolved", "ignored"]
const GAP_TYPES: Array<"" | RetrievalGapType> = [
  "",
  "stub_text",
  "missing_regulation",
  "off_point_blocked",
  "no_case_law",
  "checklist_unmet",
  "citation_metadata",
]

export default function RetrievalGapsPage() {
  const [items, setItems] = useState<ResearchRetrievalGap[]>([])
  const [stats, setStats] = useState<RetrievalGapStats | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState("")
  const [gapType, setGapType] = useState<"" | RetrievalGapType>("")
  const [countryCode, setCountryCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "manual"; text: string } | null>(
    null,
  )

  const load = useCallback(
    async (nextOffset = offset) => {
      setLoading(true)
      setMessage(null)
      try {
        const [result, nextStats] = await Promise.all([
          listRetrievalGaps({
            status: status || undefined,
            gapType: gapType || undefined,
            countryCode: countryCode || undefined,
            limit: PAGE_SIZE,
            offset: nextOffset,
          }),
          getRetrievalGapStats(),
        ])
        setItems(result.items)
        setTotal(result.total)
        setStats(nextStats)
        setOffset(nextOffset)
      } catch (error) {
        setMessage({ kind: "error", text: error instanceof Error ? error.message : "Failed to load" })
      } finally {
        setLoading(false)
      }
    },
    [countryCode, gapType, offset, status],
  )

  useEffect(() => {
    void load(0)
    // Filters are applied explicitly to avoid a request on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeStatus = async (row: ResearchRetrievalGap, nextStatus: string) => {
    setBusyId(row.id)
    try {
      const updated = await updateRetrievalGap(row.id, { status: nextStatus })
      setItems((current) => current.map((item) => (item.id === row.id ? updated : item)))
      setStats(await getRetrievalGapStats())
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Update failed" })
    } finally {
      setBusyId(null)
    }
  }

  const triggerIngest = async (row: ResearchRetrievalGap) => {
    setBusyId(row.id)
    setMessage(null)
    try {
      const result: RetrievalGapIngestResult = await triggerRetrievalGapIngest(row.id)
      setMessage({
        kind: result.state === "manual_required" ? "manual" : result.ok ? "ok" : "error",
        text: result.message,
      })
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Ingest failed" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Retrieval Gaps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verification and corpus gaps captured from real research runs
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open", stats.open],
            ["In progress", stats.inProgress],
            ["Resolved (7d)", stats.resolved7d],
            ["Ignored", stats.ignored],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="pb-3 pt-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-bold">{Number(value).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <select className="block rounded border bg-background px-2 py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((value) => <option key={value} value={value}>{value ? value.replaceAll("_", " ") : "All"}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Gap type</span>
          <select className="block rounded border bg-background px-2 py-1.5" value={gapType} onChange={(e) => setGapType(e.target.value as "" | RetrievalGapType)}>
            {GAP_TYPES.map((value) => <option key={value} value={value}>{value ? value.replaceAll("_", " ") : "All"}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Country</span>
          <Input className="h-8 w-24" value={countryCode} maxLength={2} placeholder="All" onChange={(e) => setCountryCode(e.target.value.toUpperCase())} />
        </label>
        <Button size="sm" onClick={() => void load(0)}>Apply</Button>
      </div>

      {message && (
        <Card className={message.kind === "error" ? "border-destructive/50" : message.kind === "manual" ? "border-amber-500/50" : "border-green-500/40"}>
          <CardContent className="py-3 text-sm">{message.text}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Gap", "Expected authority", "Country / domain", "Occurrences", "Detail", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-3"><Badge variant="outline">{row.gapType.replaceAll("_", " ")}</Badge></td>
                    <td className="max-w-xs px-3 py-3 font-medium">{row.expectedAuthority}</td>
                    <td className="px-3 py-3 text-xs">{row.countryCode}{row.legalDomain ? ` · ${row.legalDomain}` : ""}</td>
                    <td className="px-3 py-3 font-semibold">{row.occurrenceCount}</td>
                    <td className="max-w-sm px-3 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">View detail</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(row.detail, null, 2)}</pre>
                      </details>
                    </td>
                    <td className="px-3 py-3">
                      <select className="rounded border bg-background px-2 py-1 text-xs" value={row.status} disabled={busyId === row.id} onChange={(e) => void changeStatus(row, e.target.value)}>
                        {STATUSES.filter(Boolean).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                      </select>
                      {row.resolvedNote && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.resolvedNote}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void triggerIngest(row)}>
                        {busyId === row.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                        Trigger ingest
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No retrieval gaps found.</div>}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "0 results"}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total} onClick={() => void load(offset + PAGE_SIZE)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
