"use client"

import { useMemo, useRef, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Download,
  ExternalLink,
  FileSignature,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react"

import { GenerateDocumentFlow } from "@/components/matters/generate-document-flow"
import { MatterESignWorkspace } from "@/components/matters/matter-esign-workspace"
import { MatterReviewWorkspace } from "@/components/matters/matter-review-workspace"
import { MatterFormRecommendations } from "@/components/matters/matter-form-recommendations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  formatFileSize,
  getDocumentDownloadUrl,
  listTenantDocuments,
  type ApiTenantDocument,
} from "@/lib/api/documents"
import { useApiData } from "@/lib/hooks/use-api-data"
import { queryKeys } from "@/lib/api/query-keys"
import {
  buildFileCenterHref,
  isDocumentReviewReady,
  resolveFileCenterView,
  selectAllFiltered,
  toggleDocumentSelection,
  type ReviewDocument,
} from "@/lib/matters/file-center-state"

type MatterFileDocument = ReviewDocument & {
  coveragePercent?: number | null
  textCoverage?: number | null
  pageCount?: number | null
  extractedPageCount?: number | null
}

interface MatterFileCenterProps {
  tenantId: string
  matterId: string
  practiceArea?: string | null
  countryCode?: string | null
  jurisdiction?: string | null
  matterType?: string | null
}

function readiness(document: MatterFileDocument) {
  const status = (document.ocrStatus ?? document.extractionStatus ?? "").toUpperCase()
  const textFile = document.mimeType?.startsWith("text/")
  if (isDocumentReviewReady(document)) {
    return { key: "ready", label: textFile ? "Text ready" : "Extraction ready", variant: "secondary" as const }
  }
  if (["FAILED", "ERROR"].includes(status)) return { key: "failed", label: "Extraction failed", variant: "destructive" as const }
  if (["PENDING", "PROCESSING", "QUEUED", "RUNNING"].includes(status)) {
    return { key: "processing", label: status === "PENDING" || status === "QUEUED" ? "Extraction queued" : "Extracting", variant: "outline" as const }
  }
  return { key: "missing", label: "Text unavailable", variant: "outline" as const }
}

function coverage(document: MatterFileDocument) {
  const direct = document.coveragePercent ?? document.textCoverage
  if (typeof direct === "number") return `${Math.round(direct <= 1 ? direct * 100 : direct)}% text coverage`
  if (document.pageCount && typeof document.extractedPageCount === "number") return `${document.extractedPageCount}/${document.pageCount} pages`
  return document.extractedText ? "Extracted text available" : "No extracted text"
}

export function MatterFileCenter({
  tenantId,
  matterId,
  practiceArea,
  countryCode,
  jurisdiction,
  matterType,
}: MatterFileCenterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const requestedView = searchParams.get("view")
  const activeView = resolveFileCenterView(requestedView)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [readinessFilter, setReadinessFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const contentHeadingRef = useRef<HTMLHeadingElement>(null)

  const {
    data: documentsData = [],
    isLoading,
    isError,
    refetch,
  } = useApiData<ApiTenantDocument[]>(queryKeys.matters.documents(tenantId, matterId), {
    apiFn: () => listTenantDocuments(tenantId, { matterId }),
    enabled: !!tenantId && !!matterId,
  })
  const documents = documentsData as MatterFileDocument[]
  const documentTypes = useMemo(
    () => Array.from(new Set(documents.map((document) => document.documentType).filter(Boolean) as string[])).sort(),
    [documents],
  )
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter((document) => {
      const documentReadiness = readiness(document)
      return (
        (!query || document.fileName.toLowerCase().includes(query) || document.documentType?.toLowerCase().includes(query)) &&
        (typeFilter === "all" || document.documentType === typeFilter) &&
        (readinessFilter === "all" || documentReadiness.key === readinessFilter)
      )
    })
  }, [documents, readinessFilter, search, typeFilter])
  const filteredIds = filteredDocuments.map((document) => document.id)
  const allFilteredSelected = !!filteredIds.length && filteredIds.every((id) => selectedIds.includes(id))

  const changeView = (view: string) => {
    router.push(
      buildFileCenterHref(
        matterId,
        resolveFileCenterView(view),
        searchParams.toString(),
      ),
      { scroll: false },
    )
    window.requestAnimationFrame(() => contentHeadingRef.current?.focus())
  }

  const openDocument = async (documentId: string) => {
    setDownloadingId(documentId)
    try {
      const result = await getDocumentDownloadUrl(tenantId, documentId)
      const opened = window.open(result.fileUrl, "_blank", "noopener,noreferrer")
      if (!opened) window.location.assign(result.fileUrl)
    } catch (cause) {
      toast({
        title: "Could not open file",
        description: cause instanceof Error ? cause.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Matter file center</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage source files and run cited, matter-wide AI review.</p>
        </div>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => router.push(`/app/documents?matterId=${matterId}`)}>
          <ExternalLink className="mr-2 h-4 w-4" /> Open document library
        </Button>
      </div>

      <Tabs value={activeView} onValueChange={changeView}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="files"><FileText className="mr-2 h-4 w-4" /> Files</TabsTrigger>
          <TabsTrigger value="ai-review"><Sparkles className="mr-2 h-4 w-4" /> AI Review</TabsTrigger>
          <TabsTrigger value="generate"><Wand2 className="mr-2 h-4 w-4" /> Generate</TabsTrigger>
          <TabsTrigger value="esign"><FileSignature className="mr-2 h-4 w-4" /> E-sign</TabsTrigger>
        </TabsList>
        <h3 ref={contentHeadingRef} tabIndex={-1} className="sr-only">
          {activeView}
        </h3>

        <TabsContent value="files" className="mt-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search matter files" className="pl-9" aria-label="Search matter files" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Filter by document type"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={readinessFilter} onValueChange={setReadinessFilter}>
              <SelectTrigger aria-label="Filter by extraction readiness"><SelectValue placeholder="All readiness" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All readiness</SelectItem>
                <SelectItem value="ready">Extraction ready</SelectItem>
                <SelectItem value="processing">Extracting</SelectItem>
                <SelectItem value="missing">Text unavailable</SelectItem>
                <SelectItem value="failed">Extraction failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isLoading && !isError && documents.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{selectedIds.length} selected · {filteredDocuments.length} shown · {documents.length} total</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!filteredIds.length || allFilteredSelected}
                  onClick={() => setSelectedIds((current) => selectAllFiltered(current, filteredIds))}
                >
                  Select all filtered
                </Button>
                <Button size="sm" variant="ghost" disabled={!selectedIds.length} onClick={() => setSelectedIds([])}>Clear selection</Button>
                <Button size="sm" disabled={!selectedIds.length} onClick={() => changeView("ai-review")}>
                  Review selected ({selectedIds.length})
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2" aria-label="Loading matter files">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20" />)}</div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/30 p-8 text-center">
              <p className="text-sm font-medium text-destructive">Matter files could not be loaded.</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
          ) : !documents.length ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <FileSearch className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">No files on this matter</p>
              <p className="mt-1 text-sm text-muted-foreground">Use Upload document in the matter header to add the first file.</p>
            </div>
          ) : !filteredDocuments.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No files match the current filters.</p>
              <Button variant="link" onClick={() => { setSearch(""); setTypeFilter("all"); setReadinessFilter("all") }}>Clear filters</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((document) => {
                const state = readiness(document)
                return (
                  <Card key={document.id} className="transition-colors hover:bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.includes(document.id)}
                          onCheckedChange={() => setSelectedIds((current) => toggleDocumentSelection(current, document.id))}
                          aria-label={`Select ${document.fileName}`}
                          className="mt-1"
                        />
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <button type="button" className="max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => void openDocument(document.id)}>
                            {document.fileName}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {document.documentType && <Badge variant="outline">{document.documentType}</Badge>}
                            <Badge variant={state.variant}>{state.label}</Badge>
                            <span className="text-xs text-muted-foreground">{coverage(document)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.fileSizeBytes ? `${formatFileSize(document.fileSizeBytes)} · ` : ""}
                            Added {format(new Date(document.createdAt), "MMM d, yyyy")} · updated {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={downloadingId === document.id}
                          onClick={() => void openDocument(document.id)}
                          aria-label={`Download ${document.fileName}`}
                        >
                          {downloadingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-review" className="mt-5">
          <MatterReviewWorkspace
            tenantId={tenantId}
            matterId={matterId}
            documents={documents}
            selectedDocumentIds={selectedIds}
            onSelectedDocumentIdsChange={setSelectedIds}
            onOpenDocument={(documentId) => void openDocument(documentId)}
            documentsLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="generate" className="mt-5 space-y-5">
          <MatterFormRecommendations
            tenantId={tenantId}
            matterId={matterId}
            practiceArea={practiceArea}
            countryCode={countryCode}
            jurisdiction={jurisdiction}
            matterType={matterType}
          />
          <GenerateDocumentFlow
            tenantId={tenantId}
            matterId={matterId}
            practiceArea={practiceArea}
            countryCode={countryCode}
            onSendForSignature={(documentName) => {
              const query = new URLSearchParams(searchParams.toString())
              query.set("view", "esign")
              query.set("documentName", documentName)
              router.push(`/app/matters/${matterId}/documents?${query.toString()}`, {
                scroll: false,
              })
            }}
          />
        </TabsContent>

        <TabsContent value="esign" className="mt-5">
          <MatterESignWorkspace
            tenantId={tenantId}
            matterId={matterId}
            initialDocumentName={searchParams.get("documentName") ?? ""}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
