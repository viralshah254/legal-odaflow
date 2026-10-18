"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import {
  listTenantDocuments,
  listDocumentVersions,
  uploadTenantDocument,
  updateTenantDocument,
  archiveTenantDocument,
  uploadFileViaPresignedUrl,
  getDocumentDownloadUrl,
  type ApiTenantDocument,
  type DocumentListScope,
  type ApiDocumentVersion,
} from "@/lib/api/documents"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import type { ApiClient } from "@/lib/api/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  FileText,
  Folder,
  Link2,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Upload,
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  GitCompare,
  ShieldAlert,
  Table2,
} from "lucide-react"
import { format } from "date-fns"
import { ApiClientError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

const ALL_CLIENTS = "__all__"
const NO_CLIENT = "__none__"
const NO_MATTER = "__none__"

export default function DocumentsPage() {
  const t = useTranslations("lawyer")
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">{t("loading_documents")}</div>}>
      <DocumentsPageContent />
    </Suspense>
  )
}

function DocumentsPageContent() {
  const t = useTranslations("lawyer")
  const tCommon = useTranslations("lawyer")
  const tConsumer = useTranslations("lawyer")
  const tBilling = useTranslations("lawyer")
  const tErr = useTranslations("errors")
  const searchParams = useSearchParams()
  const urlMatterId = searchParams.get("matterId")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [scope, setScope] = useState<DocumentListScope>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [clientFilterId, setClientFilterId] = useState<string>(ALL_CLIENTS)
  const [matterFilter, setMatterFilter] = useState<string | null>(urlMatterId)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [versions, setVersions] = useState<ApiDocumentVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [archiveConfirmDoc, setArchiveConfirmDoc] = useState<ApiTenantDocument | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadClientId, setUploadClientId] = useState<string>(NO_CLIENT)
  const [uploadMatterId, setUploadMatterId] = useState<string>(urlMatterId ?? NO_MATTER)
  const [linkClientId, setLinkClientId] = useState<string>(NO_CLIENT)
  const [linkMatterId, setLinkMatterId] = useState<string>(NO_MATTER)
  const [uploading, setUploading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [actionError, setActionError] = useState("")

  // Sync URL matterId on navigation
  useEffect(() => {
    if (urlMatterId) {
      setMatterFilter(urlMatterId)
      setUploadMatterId(urlMatterId)
    }
  }, [urlMatterId])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const listParams = useMemo(() => {
    const params: {
      scope: DocumentListScope
      search?: string
      clientId?: string
      matterId?: string
    } = { scope }

    if (debouncedSearch) params.search = debouncedSearch
    if (matterFilter) params.matterId = matterFilter

    if (scope === "client" && clientFilterId !== ALL_CLIENTS) {
      params.clientId = clientFilterId
    }

    return params
  }, [scope, debouncedSearch, clientFilterId, matterFilter])

  const listQueryKey = ["documents", activeTenantId, listParams] as const

  const { data: documents = [], isLoading } = useApiData(listQueryKey, {
    apiFn: () => listTenantDocuments(activeTenantId!, listParams),
    enabled: !!activeTenantId,
  })

  const { data: clients = [] } = useApiData(["clients", activeTenantId] as const, {
    apiFn: () => listClients(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const { data: matters = [] } = useApiData(["matters", activeTenantId] as const, {
    apiFn: () => listMatters(activeTenantId!),
    enabled: !!activeTenantId,
  })

  // Lookup: matter title for breadcrumb
  const urlMatter = useMemo(() => {
    if (!urlMatterId) return null
    return matters.find((m) => m.id === urlMatterId) ?? null
  }, [urlMatterId, matters])

  const selectedDoc = documents.find((d) => d.id === selectedDocId) ?? null

  const intelligenceStats = useMemo(() => {
    const withText = documents.filter((doc) => Boolean(doc.extractedText?.trim())).length
    const linkedToMatter = documents.filter((doc) => Boolean(doc.matterId)).length
    const privateDocs = documents.filter((doc) => doc.visibility === "PRIVATE").length
    const contracts = documents.filter((doc) =>
      /contract|agreement|msa|nda|sow|lease/i.test(doc.fileName),
    ).length
    return [
      { label: "OCR / extracted", value: `${withText}/${documents.length}`, icon: FileText },
      { label: "Matter linked", value: linkedToMatter.toLocaleString(), icon: Link2 },
      { label: "Private", value: privateDocs.toLocaleString(), icon: Archive },
      { label: "Bundle ready", value: documents.filter((doc) => doc.matterId && doc.extractedText).length.toLocaleString(), icon: Folder },
      { label: "Contracts", value: contracts.toLocaleString(), icon: CalendarClock },
      { label: "Risk review", value: contracts ? "Needed" : "Ready", icon: ShieldAlert },
      { label: "Redlines", value: "Track", icon: GitCompare },
    ]
  }, [documents])

  const filteredMatters = useMemo(() => {
    const clientId =
      uploadOpen && uploadClientId !== NO_CLIENT
        ? uploadClientId
        : linkOpen && linkClientId !== NO_CLIENT
          ? linkClientId
          : null
    if (!clientId) return matters
    return matters.filter((m) => m.clientId === clientId)
  }, [matters, uploadOpen, linkOpen, uploadClientId, linkClientId])

  const refreshDocuments = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["documents"] })
  }, [queryClient])

  useEffect(() => {
    if (!selectedDocId || !activeTenantId) {
      setVersions([])
      setPreviewUrl(null)
      return
    }

    setVersionsLoading(true)
    void listDocumentVersions(activeTenantId, selectedDocId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false))

    setPreviewLoading(true)
    setPreviewUrl(null)
    void getDocumentDownloadUrl(activeTenantId, selectedDocId)
      .then(({ fileUrl }) => setPreviewUrl(fileUrl))
      .catch(() => setPreviewUrl(null))
      .finally(() => setPreviewLoading(false))
  }, [selectedDocId, activeTenantId])

  const handleDownload = async (doc: ApiTenantDocument) => {
    if (!activeTenantId) return
    try {
      const { fileUrl, fileName } = await getDocumentDownloadUrl(activeTenantId, doc.id)
      const anchor = document.createElement("a")
      anchor.href = fileUrl
      anchor.download = fileName
      anchor.target = "_blank"
      anchor.rel = "noopener noreferrer"
      anchor.click()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Download failed")
    }
  }

  const handleUpload = async () => {
    if (!activeTenantId || !uploadFile) return
    setUploading(true)
    setActionError("")
    try {
      const { fileUrl, fileName } = await uploadFileViaPresignedUrl(activeTenantId, uploadFile)
      const doc = await uploadTenantDocument(activeTenantId, {
        fileName,
        fileUrl,
        mimeType: uploadFile.type || undefined,
        clientId: uploadClientId !== NO_CLIENT ? uploadClientId : undefined,
        matterId: uploadMatterId !== NO_MATTER ? uploadMatterId : undefined,
      })
      setUploadOpen(false)
      setUploadFile(null)
      setUploadClientId(NO_CLIENT)
      setUploadMatterId(urlMatterId ?? NO_MATTER)
      setSelectedDocId(doc.id)
      refreshDocuments()
      toast({ title: tErr("toast.documentUploaded"), description: doc.fileName })
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : tErr("toast.uploadFailed")
      setActionError(msg)
      toast({ title: tErr("toast.uploadFailed"), description: msg, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleLinkClient = async () => {
    if (!activeTenantId || !selectedDoc) return
    setLinking(true)
    setActionError("")
    try {
      await updateTenantDocument(activeTenantId, selectedDoc.id, {
        clientId: linkClientId !== NO_CLIENT ? linkClientId : null,
        matterId: linkMatterId !== NO_MATTER ? linkMatterId : null,
      })
      setLinkOpen(false)
      refreshDocuments()
      toast({ title: tErr("toast.documentLinked") })
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : tErr("toast.failedToLink")
      setActionError(msg)
      toast({ title: tErr("toast.failedToLink"), variant: "destructive" })
    } finally {
      setLinking(false)
    }
  }

  const handleArchive = async () => {
    if (!activeTenantId || !archiveConfirmDoc) return
    setArchiving(true)
    try {
      await archiveTenantDocument(activeTenantId, archiveConfirmDoc.id)
      refreshDocuments()
      if (selectedDocId === archiveConfirmDoc.id) setSelectedDocId(null)
      toast({ title: tErr("toast.documentArchived"), description: archiveConfirmDoc.fileName })
      setArchiveConfirmDoc(null)
    } catch {
      toast({ title: tErr("toast.failedToArchive"), variant: "destructive" })
    } finally {
      setArchiving(false)
    }
  }

  const openLinkDialog = (doc: ApiTenantDocument) => {
    setSelectedDocId(doc.id)
    setLinkClientId(doc.clientId ?? NO_CLIENT)
    setLinkMatterId(doc.matterId ?? NO_MATTER)
    setLinkOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back to matter breadcrumb */}
      {urlMatterId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/app/matters/${urlMatterId}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {urlMatter?.title ?? "Matter"}
          </Link>
        </div>
      )}

      {/* Tabular Review discovery banner */}
      <Link
        href="/app/document-review"
        className="group flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20 px-4 py-3.5 hover:border-violet-300 dark:hover:border-violet-800 transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/60 flex items-center justify-center shrink-0">
          <Table2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
            Compare two documents side-by-side
          </p>
          <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5">
            Tabular Review — clause-by-clause comparison with AI risk scoring for M&amp;A and contract work
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-violet-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Folder className="h-8 w-8" />
            Documents
            {urlMatterId && urlMatter && (
              <Badge variant="secondary" className="ml-1">
                {urlMatter.title}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse firm documents, version history, and secure downloads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {urlMatterId && (
            <Button variant="outline" size="sm" onClick={() => setMatterFilter(null)}>
              Clear matter filter
            </Button>
          )}
          <Button onClick={() => setUploadOpen(true)} data-tour="documents-upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {intelligenceStats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {actionError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[640px]">
        <Card className="flex flex-col">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>{t("document_library")}</CardTitle>
              <CardDescription>
                {matterFilter
                  ? `Filtered to matter documents`
                  : scope === "general"
                    ? "Firm-wide documents not linked to a client"
                    : scope === "client"
                      ? "Documents linked to clients"
                      : "All tenant documents"}
              </CardDescription>
            </div>

            {!matterFilter && (
              <Tabs
                value={scope}
                onValueChange={(v) => setScope(v as DocumentListScope)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">{tCommon("all")}</TabsTrigger>
                  <TabsTrigger value="general">{t("general")}</TabsTrigger>
                  <TabsTrigger value="client">{t("by_client")}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("search_documents_client_name_or_code")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {scope === "client" && !matterFilter && (
                <ClientSelect
                  clients={clients}
                  value={clientFilterId}
                  onChange={setClientFilterId}
                  allowAll
                />
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{t("no_documents_found")}</p>
            ) : (
              <ul className="divide-y" data-tour="documents-list">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center group">
                    <button
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`flex-1 text-left px-3 py-3 hover:bg-muted/50 transition-colors ${
                        selectedDocId === doc.id ? "bg-muted/60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{doc.fileName}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {doc.client ? (
                              <Badge variant="secondary" className="text-xs">
                                {doc.client.clientCode} · {doc.client.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                General
                              </Badge>
                            )}
                            {doc.documentCode && (
                              <span className="text-xs text-muted-foreground">{doc.documentCode}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                            {doc.matter ? ` · ${doc.matter.title}` : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void handleDownload(doc)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openLinkDialog(doc)}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Link to client/matter
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setArchiveConfirmDoc(doc)}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          {!selectedDoc ? (
            <>
              <CardHeader>
                <CardTitle>{t("document_detail")}</CardTitle>
                <CardDescription>{t("version_history_and_download_access")}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center">
                <p className="text-center text-muted-foreground py-12">
                  Select a document to preview it.
                </p>
              </CardContent>
            </>
          ) : (
            <Tabs defaultValue="preview" className="flex flex-col flex-1 min-h-0">
              <CardHeader className="pb-0 space-y-3">
                <div className="space-y-1">
                  <CardTitle className="truncate text-base">{selectedDoc.fileName}</CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDoc.client ? (
                      <Badge>{selectedDoc.client.clientCode} · {selectedDoc.client.name}</Badge>
                    ) : (
                      <Badge variant="outline">{t("general")}</Badge>
                    )}
                    {selectedDoc.documentCode && (
                      <Badge variant="secondary">{selectedDoc.documentCode}</Badge>
                    )}
                  </div>
                  {selectedDoc.matter && (
                    <p className="text-xs text-muted-foreground">Matter: {selectedDoc.matter.title}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleDownload(selectedDoc)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openLinkDialog(selectedDoc)}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Link to client
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setArchiveConfirmDoc(selectedDoc)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                </div>
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="preview" className="flex-1 min-h-0 overflow-hidden mt-0 p-0">
                <DocumentPreview
                  fileName={selectedDoc.fileName}
                  mimeType={selectedDoc.mimeType}
                  extractedText={selectedDoc.extractedText}
                  previewUrl={previewUrl}
                  loading={previewLoading}
                  onDownload={() => void handleDownload(selectedDoc)}
                />
              </TabsContent>

              <TabsContent value="details" className="flex-1 overflow-auto mt-0">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium mb-3">{t("version_history")}</h4>
                  {versionsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("version_1_current")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {versions.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span>v{v.version} · {v.fileName}</span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(v.createdAt), "MMM d, yyyy")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tConsumer("upload_document_2")}</DialogTitle>
            <DialogDescription>
              Add a firm document. Optionally link it to a client and matter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">{tCommon("file")}</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("client_optional")}</Label>
              <ClientSelect
                clients={clients}
                value={uploadClientId}
                onChange={(id) => {
                  setUploadClientId(id)
                  if (!urlMatterId) setUploadMatterId(NO_MATTER)
                }}
                allowNone
              />
            </div>
            {uploadClientId !== NO_CLIENT && (
              <div className="space-y-2">
                <Label>{tCommon("matter_optional_2")}</Label>
                <MatterSelect
                  matters={filteredMatters}
                  value={uploadMatterId}
                  onChange={setUploadMatterId}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpload()} disabled={!uploadFile || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("link_document_to_client")}</DialogTitle>
            <DialogDescription>
              Associate this document with a client and optional matter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tBilling("client")}</Label>
              <ClientSelect
                clients={clients}
                value={linkClientId}
                onChange={(id) => {
                  setLinkClientId(id)
                  setLinkMatterId(NO_MATTER)
                }}
                allowNone
              />
            </div>
            {linkClientId !== NO_CLIENT && (
              <div className="space-y-2">
                <Label>{tCommon("matter_optional_2")}</Label>
                <MatterSelect
                  matters={filteredMatters}
                  value={linkMatterId}
                  onChange={setLinkMatterId}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleLinkClient()} disabled={linking}>
              {linking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm dialog */}
      <Dialog open={!!archiveConfirmDoc} onOpenChange={(o) => !o && setArchiveConfirmDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archive_document")}</DialogTitle>
            <DialogDescription>
              <strong>{archiveConfirmDoc?.fileName}</strong> will be archived and removed from active views.
              This action can be reversed by your admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmDoc(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ─── Document Preview ────────────────────────────────────────────────────────

function getPreviewType(fileName: string, mimeType?: string | null): "iframe" | "text" | "none" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const mime = mimeType?.toLowerCase() ?? ""
  if (mime === "text/html" || ext === "html" || ext === "htm") return "iframe"
  if (mime === "application/pdf" || ext === "pdf") return "iframe"
  if (
    ext === "docx" || ext === "doc" ||
    ext === "txt" || ext === "md" ||
    mime.startsWith("text/")
  ) return "text"
  return "none"
}

function DocumentPreview({
  fileName,
  mimeType,
  extractedText,
  previewUrl,
  loading,
  onDownload,
}: {
  fileName: string
  mimeType?: string | null
  extractedText?: string | null
  previewUrl: string | null
  loading: boolean
  onDownload: () => void
}) {
  const type = getPreviewType(fileName, mimeType)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (type === "iframe" && previewUrl) {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full min-h-[480px] border-0"
      />
    )
  }

  if (type === "text") {
    const content = extractedText?.trim()
    if (content) {
      return (
        <div className="h-full overflow-auto p-4">
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
            {content}
          </pre>
        </div>
      )
    }
  }

  // Fallback: no inline preview possible
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-muted-foreground">
      <FileText className="h-12 w-12 opacity-30" />
      <p className="text-sm">No preview available for this file type.</p>
      <Button size="sm" variant="outline" onClick={onDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download to view
      </Button>
    </div>
  )
}

function ClientSelect({
  clients,
  value,
  onChange,
  allowAll,
  allowNone,
}: {
  clients: ApiClient[]
  value: string
  onChange: (id: string) => void
  allowAll?: boolean
  allowNone?: boolean
}) {
  const tClients = useTranslations("clients")
  const tBilling = useTranslations("billing")
  const t = useTranslations("common")
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={tClients("selectClient")} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL_CLIENTS}>{tBilling("all_clients")}</SelectItem>}
        {allowNone && <SelectItem value={NO_CLIENT}>{t("no_client_general")}</SelectItem>}
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.clientCode} · {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MatterSelect({
  matters,
  value,
  onChange,
}: {
  matters: { id: string; title: string }[]
  value: string
  onChange: (id: string) => void
}) {
  const tCommon = useTranslations("common")
  const t = useTranslations("common")
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={tCommon("select_matter")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_MATTER}>{t("no_matter")}</SelectItem>
        {matters.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
