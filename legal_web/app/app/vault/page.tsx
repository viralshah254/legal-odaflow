"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useTenant } from "@/lib/contexts/tenant-context"
import { apiFetch } from "@/lib/api/client"
import { listTenantDocuments } from "@/lib/api/documents"
import { listMatters } from "@/lib/api/matters"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  Archive,
  Loader2,
  Search,
  ShieldCheck,
  FolderOpen,
  FileText,
  MessageSquare,
  Zap,
  Clock,
  Database,
  Lock,
  Plus,
  Eye,
  ChevronRight,
  Layers,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format } from "date-fns"

interface FirmMemoryHit {
  id: string
  sourceType: string
  sourceId: string
  matterId: string | null
  content: string
  score: number
  title?: string
}

interface VaultProject {
  id: string
  name: string
  type: "matter" | "adhoc"
  fileCount: number
  queryCount: number
  lastActivity: string | null
  status: string
  countryCode?: string | null
  practiceArea?: string | null
}

export default function VaultPage() {
  const t = useTranslations("lawyer")
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<FirmMemoryHit[]>([])
  const [searching, setSearching] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const { data: documents = [], isLoading: docsLoading } = useApiData(
    ["vault-documents", activeTenantId],
    {
      apiFn: () => listTenantDocuments(activeTenantId!, {}),
      enabled: !!activeTenantId,
    },
  )

  const { data: mattersRaw = [], isLoading: mattersLoading } = useApiData(
    ["vault-matters", activeTenantId],
    {
      apiFn: () => listMatters(activeTenantId!, { limit: 100 }),
      enabled: !!activeTenantId,
    },
  )

  const vaultProjects: VaultProject[] = (Array.isArray(mattersRaw) ? mattersRaw : []).map((m) => ({
    id: m.id,
    name: m.title ?? m.id,
    type: "matter" as const,
    fileCount: documents.filter((d) => d.matterId === m.id).length,
    queryCount: 0,
    lastActivity: m.updatedAt ?? null,
    status: m.status ?? "OPEN",
    countryCode: m.countryCode ?? null,
    practiceArea: m.practiceArea ?? null,
  }))

  const runSearch = async () => {
    if (!activeTenantId || !query.trim()) return
    setSearching(true)
    try {
      const res = await apiFetch<{ hits: FirmMemoryHit[] }>(
        `/firm-memory/search?q=${encodeURIComponent(query.trim())}&limit=25`,
        { tenantId: activeTenantId },
      )
      setHits(res.hits)
    } finally {
      setSearching(false)
    }
  }

  const totalFiles = documents.length
  const totalProjects = vaultProjects.length
  const isLoading = docsLoading || mattersLoading

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header — Harvey-style "Secured by Vault" hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Umbrella Vault
                <Badge
                  variant="secondary"
                  className="ml-1 gap-1 text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Secured
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Firm knowledge, documents, and AI query history — protected by ethical walls.
              </p>
            </div>
          </div>

          {/* Vault stats */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">
                {isLoading ? "—" : totalProjects}
              </p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">
                {isLoading ? "—" : totalFiles}
              </p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">
                {hits.length > 0 ? hits.length : "∞"}
              </p>
              <p className="text-xs text-muted-foreground">Memories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Semantic search bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Firm memory search</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Semantic search across all matters, documents, and approved AI work product.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search clauses, facts, prior work product, redlines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              data-tour="vault-search"
              className="flex-1"
            />
            <Button onClick={() => void runSearch()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {hits.length > 0 && (
            <div className="space-y-2 max-h-[360px] overflow-y-auto rounded-lg border p-3">
              {hits.map((hit) => (
                <div key={hit.id} className="rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{hit.title ?? hit.sourceType}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{hit.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {hit.matterId && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {hit.matterId.slice(0, 8)}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {hit.sourceType}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {(hit.score * 100).toFixed(0)}% match
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project grid — Harvey-style card layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Vault projects</h2>
            <Badge variant="secondary" className="text-[10px]">{totalProjects}</Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
            <Link href="/app/matters/new">
              <Plus className="h-3.5 w-3.5" />
              New project
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading vault…</span>
          </div>
        )}

        {!isLoading && vaultProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Archive className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No vault projects yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a matter to start a Vault project.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" asChild>
              <Link href="/app/matters/new">
                <Plus className="h-3.5 w-3.5" />
                Create matter
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {vaultProjects.map((project) => {
            const isActive = activeProjectId === project.id
            const docCount = documents.filter((d) => d.matterId === project.id).length

            return (
              <div
                key={project.id}
                onClick={() => setActiveProjectId(isActive ? null : project.id)}
                className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                  isActive ? "border-primary/50 bg-primary/5 shadow-md" : "bg-card hover:bg-muted/20"
                }`}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{project.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {project.practiceArea && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {project.practiceArea}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 font-normal ${
                          project.status === "OPEN"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-muted"
                        }`}
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {docCount} file{docCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {project.queryCount} queries
                  </span>
                  {project.lastActivity && (
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {format(new Date(project.lastActivity), "MMM d")}
                    </span>
                  )}
                </div>

                {/* Secured badge row */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                    <ShieldCheck className="h-3 w-3" />
                    Secured by Umbrella Vault
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/app/matters/${project.id}`}>
                        <Eye className="h-3 w-3" />
                        Open
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/app/copilot?matterId=${project.id}`}>
                        <Zap className="h-3 w-3" />
                        Ask AI
                      </Link>
                    </Button>
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        isActive ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded: recent files */}
                {isActive && (
                  <div className="mt-3 pt-3 border-t space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Files in vault
                    </p>
                    {documents
                      .filter((d) => d.matterId === project.id)
                      .slice(0, 5)
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{doc.fileName}</span>
                        </div>
                      ))}
                    {docCount === 0 && (
                      <p className="text-xs text-muted-foreground italic">No files uploaded yet</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs h-7 gap-1.5"
                      asChild
                    >
                      <Link href={`/app/matters/${project.id}`}>
                        <Plus className="h-3 w-3" />
                        Upload to vault
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
