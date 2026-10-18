"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, BookOpen, Plus, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import {
  enqueueCorpusSync,
  getIngestStatus,
  resolveIndexedSectionCount,
  seedPrioritySections,
} from "@/lib/api/law-library"
import { getCorpusHealth, type CorpusHealthRow } from "@/lib/api/admin"

interface LegalSource {
  id: string
  countryCode: string
  name: string
  authorityType: string
  chunkCount: number
  updatedAt: string
}

const COUNTRY_OPTIONS = [
  { value: "IN", label: "India (IN)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "KE", label: "Kenya (KE)" },
]

const TYPE_OPTIONS = [
  { value: "STATUTE", label: "Statute" },
  { value: "CASE_LAW", label: "Case Law" },
  { value: "REGULATION", label: "Regulation" },
  { value: "COMMENTARY", label: "Commentary" },
]

interface IngestForm {
  countryCode: string
  title: string
  authorityType: string
  sourceName: string
  citation: string
  jurisdiction: string
  sourceUrl: string
  fullText: string
  summary: string
}

const EMPTY_FORM: IngestForm = {
  countryCode: "IN",
  title: "",
  authorityType: "STATUTE",
  sourceName: "",
  citation: "",
  jurisdiction: "",
  sourceUrl: "",
  fullText: "",
  summary: "",
}

export default function AdminLegalSourcesPage() {
  const [sources, setSources] = useState<LegalSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<IngestForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [corpusCountry, setCorpusCountry] = useState("IN")
  const [corpusBusy, setCorpusBusy] = useState<string | null>(null)
  const [ingestCounts, setIngestCounts] = useState<Record<string, number>>({})
  const [corpusHealth, setCorpusHealth] = useState<CorpusHealthRow[]>([])

  const load = () => {
    setLoading(true)
    apiFetch<LegalSource[]>("/admin/legal-sources")
      .then(setSources)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    void Promise.all([
      Promise.all(
        COUNTRY_OPTIONS.map(async (c) => {
          const status = await getIngestStatus(c.value)
          return [c.value, resolveIndexedSectionCount(status, c.value)] as const
        }),
      ),
      getCorpusHealth(),
    ])
      .then(([rows, health]) => {
        setIngestCounts(Object.fromEntries(rows))
        setCorpusHealth(health)
      })
      .catch(() => undefined)
  }, [success])

  const runCorpusAction = async (action: "seed" | "sync") => {
    setCorpusBusy(action)
    setError("")
    setSuccess("")
    try {
      if (action === "seed") {
        await seedPrioritySections(corpusCountry)
        setSuccess(`Priority sections seeded for ${corpusCountry}.`)
      } else {
        await enqueueCorpusSync(corpusCountry)
        setSuccess(`Corpus sync enqueued for ${corpusCountry}.`)
      }
      const status = await getIngestStatus(corpusCountry)
      setIngestCounts((prev) => ({
        ...prev,
        [corpusCountry]: resolveIndexedSectionCount(status, corpusCountry),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Corpus action failed")
    } finally {
      setCorpusBusy(null)
    }
  }

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.sourceName.trim() || !form.fullText.trim()) {
      setError("Title, source name, and full text are required.")
      return
    }
    setSubmitting(true)
    setError("")
    setSuccess("")
    try {
      const result = await apiFetch<{ chunksCreated?: number; message?: string }>(
        "/admin/legal-sources/ingest",
        {
          method: "POST",
          body: {
            countryCode: form.countryCode,
            title: form.title,
            authorityType: form.authorityType,
            sourceName: form.sourceName,
            citation: form.citation || undefined,
            jurisdiction: form.jurisdiction || undefined,
            sourceUrl: form.sourceUrl || undefined,
            fullText: form.fullText,
            summary: form.summary || undefined,
          },
        },
      )
      const chunks = result.chunksCreated ?? 0
      setSuccess(`Ingested successfully${chunks ? ` · ${chunks} chunk${chunks !== 1 ? "s" : ""} created` : ""}.`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed")
    } finally {
      setSubmitting(false)
    }
  }

  const set = (field: keyof IngestForm) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Legal Sources</h1>
          <p className="text-muted-foreground text-sm mt-1">RAG source registry ({sources.length})</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
          {showForm ? "Hide form" : "Ingest new source"}
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Law Library corpus — IN / US / KE / GB
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seed priority statute sections immediately, or enqueue tier-1 corpus sync for a country.
          </p>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map((c) => (
              <span key={c.value} className="text-xs rounded-md border px-2 py-1">
                {c.value}: {(ingestCounts[c.value] ?? "…").toString()} indexed
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={corpusCountry} onValueChange={setCorpusCountry}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={corpusBusy !== null}
              onClick={() => void runCorpusAction("seed")}
            >
              {corpusBusy === "seed" && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Seed priority sections
            </Button>
            <Button
              type="button"
              disabled={corpusBusy !== null}
              onClick={() => void runCorpusAction("sync")}
            >
              {corpusBusy === "sync" && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Sync corpus
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Corpus health — heading-only / stub sections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNTRY_OPTIONS.map((country) => {
              const rows = corpusHealth.filter((row) => row.countryCode === country.value)
              const total = rows.reduce((sum, row) => sum + row.total, 0)
              const stubs = rows.reduce((sum, row) => sum + row.headingOnly, 0)
              return (
                <div key={country.value} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{country.value} stub ratio</p>
                  <p className="mt-1 text-lg font-bold">
                    {total ? `${((stubs / total) * 100).toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{stubs} / {total} sections</p>
                </div>
              )
            })}
          </div>
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 border-b bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Country</th>
                  <th className="px-3 py-2 text-left">Act</th>
                  <th className="px-3 py-2 text-right">Sections</th>
                  <th className="px-3 py-2 text-right">Stubs</th>
                  <th className="px-3 py-2 text-right">Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {corpusHealth.map((row) => (
                  <tr key={`${row.countryCode}:${row.actId}`}>
                    <td className="px-3 py-2">{row.countryCode}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.actId}</td>
                    <td className="px-3 py-2 text-right">{row.total}</td>
                    <td className="px-3 py-2 text-right">{row.headingOnly}</td>
                    <td className="px-3 py-2 text-right">{(row.stubRatio * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ingest form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ingest Legal Authority</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIngest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={form.countryCode} onValueChange={set("countryCode")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Authority Type</Label>
                  <Select value={form.authorityType} onValueChange={set("authorityType")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Income Tax Act 1961" />
                </div>
                <div className="space-y-1.5">
                  <Label>Source Name *</Label>
                  <Input value={form.sourceName} onChange={(e) => set("sourceName")(e.target.value)} placeholder="e.g. India Code" />
                </div>
                <div className="space-y-1.5">
                  <Label>Citation</Label>
                  <Input value={form.citation} onChange={(e) => set("citation")(e.target.value)} placeholder="e.g. ITA 1961" />
                </div>
                <div className="space-y-1.5">
                  <Label>Jurisdiction</Label>
                  <Input value={form.jurisdiction} onChange={(e) => set("jurisdiction")(e.target.value)} placeholder="e.g. India" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Source URL</Label>
                  <Input value={form.sourceUrl} onChange={(e) => set("sourceUrl")(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Summary</Label>
                <Textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => set("summary")(e.target.value)}
                  placeholder="Brief one-paragraph summary..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  Full Text *
                  <span className="text-xs text-muted-foreground font-normal">
                    {form.fullText.length.toLocaleString()} chars
                  </span>
                </Label>
                <Textarea
                  rows={8}
                  value={form.fullText}
                  onChange={(e) => set("fullText")(e.target.value)}
                  placeholder="Paste the full statutory or case law text here..."
                  className="font-mono text-xs"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Ingest
                </Button>
                <Button type="button" variant="outline" onClick={() => { setForm(EMPTY_FORM); setShowForm(false) }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!showForm && error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      {!showForm && success && (
        <Card className="mb-4 border-green-500/30">
          <CardContent className="py-3 text-sm text-green-600 dark:text-green-400">{success}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Country</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Chunks</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-sm">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{s.countryCode}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{s.authorityType}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden lg:table-cell">
                    {(s.chunkCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sources.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No legal sources found.</div>
          )}
        </div>
      )}
    </div>
  )
}
