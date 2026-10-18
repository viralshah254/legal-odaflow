"use client"

import { useMemo, useRef, useState } from "react"
import { Download, Eye, File, FileImage, FileSpreadsheet, FileText, FolderOpen, Loader2, Search, Send, Trash2, Upload, X } from "lucide-react"
import { useTranslations } from "next-intl"

import type { ApiMatter } from "@/lib/api/types"
import type { ApiTenantDocument } from "@/lib/api/documents"
import { getMatterDisplayTitle } from "@/lib/leads/lead-display-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClientWorkspaceEmpty,
  ClientWorkspaceError,
  ClientWorkspaceLoading,
} from "./client-workspace-state"

const CLIENT_ONLY_DOCUMENT = "__client_only__"

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith("image/")) return FileImage
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
    return FileSpreadsheet
  }
  return FileText
}

interface ClientDocumentsPanelProps {
  documents: ApiTenantDocument[]
  matters: ApiMatter[]
  isLoading: boolean
  hasError: boolean
  isUploading: boolean
  uploadProgress: number
  onRetry: () => void
  onUpload: (file: globalThis.File, documentType: string, matterId?: string) => Promise<boolean>
  onDelete: (documentId: string) => Promise<boolean>
  onOpen: (documentId: string, mode: "preview" | "download") => Promise<void>
  onRequest: (title: string, matterId?: string) => Promise<boolean>
}

export function ClientDocumentsPanel({
  documents,
  matters,
  isLoading,
  hasError,
  isUploading,
  uploadProgress,
  onRetry,
  onUpload,
  onDelete,
  onOpen,
  onRequest,
}: ClientDocumentsPanelProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<globalThis.File | null>(null)
  const [documentType, setDocumentType] = useState("")
  const [matterId, setMatterId] = useState(CLIENT_ONLY_DOCUMENT)
  const [documentToDelete, setDocumentToDelete] = useState<ApiTenantDocument | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("__all__")
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestTitle, setRequestTitle] = useState("")
  const [requestMatterId, setRequestMatterId] = useState(CLIENT_ONLY_DOCUMENT)
  const [isRequesting, setIsRequesting] = useState(false)

  const documentTypes = useMemo(
    () => Array.from(new Set(documents.map((document) => document.documentType).filter(Boolean) as string[])).sort(),
    [documents],
  )
  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return documents.filter((document) => {
      const matchesSearch =
        !normalizedSearch ||
        [document.fileName, document.documentType, document.matter?.title]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch))
      return matchesSearch && (typeFilter === "__all__" || document.documentType === typeFilter)
    })
  }, [documents, search, typeFilter])

  const clientOnlyDocuments = useMemo(
    () => filteredDocuments.filter((document) => !document.matterId),
    [filteredDocuments],
  )
  const matterDocuments = useMemo(
    () => filteredDocuments.filter((document) => Boolean(document.matterId)),
    [filteredDocuments],
  )

  const resetUpload = () => {
    setFile(null)
    setDocumentType("")
    setMatterId(CLIENT_ONLY_DOCUMENT)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitUpload = async () => {
    if (!file) return
    const succeeded = await onUpload(
      file,
      documentType,
      matterId === CLIENT_ONLY_DOCUMENT ? undefined : matterId,
    )
    if (succeeded) resetUpload()
  }

  const confirmDelete = async () => {
    if (!documentToDelete) return
    setIsDeleting(true)
    try {
      if (await onDelete(documentToDelete.id)) setDocumentToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const submitRequest = async () => {
    if (!requestTitle.trim()) return
    setIsRequesting(true)
    try {
      if (await onRequest(
        requestTitle.trim(),
        requestMatterId === CLIENT_ONLY_DOCUMENT ? undefined : requestMatterId,
      )) {
        setRequestOpen(false)
        setRequestTitle("")
        setRequestMatterId(CLIENT_ONLY_DOCUMENT)
      }
    } finally {
      setIsRequesting(false)
    }
  }

  const renderRows = (items: ApiTenantDocument[]) => (
    <div className="divide-y divide-border/60">
      {items.map((document) => {
        const Icon = getFileIcon(document.mimeType)
        const matterTitle =
          document.matter?.title ??
          matters.find((matter) => matter.id === document.matterId)?.title
        return (
          <div
            key={document.id}
            className="group flex min-w-0 items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{document.fileName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {document.documentType ? (
                  <Badge variant="secondary" className="h-4 px-1.5 text-xs">
                    {document.documentType}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(document.fileSizeBytes)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(document.createdAt).toLocaleDateString()}
                </span>
                {document.matterId ? (
                  <Badge variant="outline" className="h-4 border-primary/30 px-1.5 text-xs text-primary/80">
                    {matterTitle ? getMatterDisplayTitle(matterTitle) : t("matterLinked")}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void onOpen(document.id, "preview")}
                aria-label={t("previewDocument", { name: document.fileName })}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void onOpen(document.id, "download")}
                aria-label={t("downloadDocument", { name: document.fileName })}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDocumentToDelete(document)}
                aria-label={t("removeDocument", { name: document.fileName })}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <section className="space-y-4" aria-labelledby="client-documents-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="client-documents-heading" className="text-lg font-semibold">
            {t("clientDocuments")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("clientDocumentsDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("requestDocument")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {tc("upload")}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {file ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_auto_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-1">
              <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <Input
              className="h-9 text-xs"
              aria-label={t("documentTypeOptional")}
              placeholder={t("documentTypeOptional")}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            />
            <Select value={matterId} onValueChange={setMatterId}>
              <SelectTrigger className="h-9 text-xs" aria-label={t("documentAssociation")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLIENT_ONLY_DOCUMENT}>{t("clientLevelFile")}</SelectItem>
                {matters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {getMatterDisplayTitle(matter.title)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" onClick={() => void submitUpload()} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : tc("confirm")}
            </Button>
            {isUploading ? (
              <div className="space-y-1 sm:col-span-2 lg:col-span-full" aria-live="polite">
                <Progress value={uploadProgress} aria-label={t("uploadProgress", { progress: uploadProgress })} />
                <p className="text-xs text-muted-foreground">{t("uploadProgress", { progress: uploadProgress })}</p>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetUpload}
              disabled={isUploading}
              aria-label={tc("cancel")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !hasError && documents.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchDocuments")}
              aria-label={t("searchDocuments")}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label={t("filterDocumentType")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("allDocumentTypes")}</SelectItem>
              {documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {isLoading ? (
        <ClientWorkspaceLoading label={t("loadingDocuments")} compact />
      ) : hasError ? (
        <ClientWorkspaceError
          title={t("documentsLoadFailed")}
          retryLabel={tc("retry")}
          onRetry={onRetry}
          compact
        />
      ) : documents.length === 0 ? (
        <ClientWorkspaceEmpty
          icon={FolderOpen}
          title={t("noDocumentsYet")}
          description={t("noDocumentsYetDescription")}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("uploadFirstDocument")}
            </Button>
          }
        />
      ) : filteredDocuments.length === 0 ? (
        <ClientWorkspaceEmpty
          icon={Search}
          title={t("noMatchingDocuments")}
          description={t("noMatchingDocumentsDescription")}
          action={<Button variant="outline" size="sm" onClick={() => { setSearch(""); setTypeFilter("__all__") }}>{tc("clear_filters")}</Button>}
        />
      ) : (
        <div className="space-y-6">
          <DocumentSection
            headingId="client-only-documents-heading"
            title={t("clientLevelFiles", { count: clientOnlyDocuments.length })}
            description={t("clientLevelFilesDescription")}
            emptyLabel={t("noClientLevelFiles")}
          >
            {clientOnlyDocuments.length ? renderRows(clientOnlyDocuments) : null}
          </DocumentSection>
          <DocumentSection
            headingId="matter-documents-heading"
            title={t("matterLinkedFiles", { count: matterDocuments.length })}
            description={t("matterLinkedFilesDescription")}
            emptyLabel={t("noMatterLinkedFiles")}
          >
            {matterDocuments.length ? renderRows(matterDocuments) : null}
          </DocumentSection>
        </div>
      )}

      <Dialog
        open={Boolean(documentToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open && !isDeleting) setDocumentToDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeClientDocumentTitle")}</DialogTitle>
            <DialogDescription>
              {documentToDelete
                ? t("removeClientDocumentDescription", { name: documentToDelete.fileName })
                : t("archiveDocumentDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDocumentToDelete(null)} disabled={isDeleting}>
              {tc("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("removeDocumentAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={requestOpen} onOpenChange={(open: boolean) => !isRequesting && setRequestOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requestDocument")}</DialogTitle>
            <DialogDescription>{t("requestDocumentDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
              placeholder={t("requestDocumentPlaceholder")}
              aria-label={t("requestDocumentTitle")}
              autoFocus
            />
            <Select value={requestMatterId} onValueChange={setRequestMatterId}>
              <SelectTrigger aria-label={t("documentAssociation")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={CLIENT_ONLY_DOCUMENT}>{t("clientLevelRequest")}</SelectItem>
                {matters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>{getMatterDisplayTitle(matter.title)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={isRequesting}>{tc("cancel")}</Button>
            <Button onClick={() => void submitRequest()} disabled={!requestTitle.trim() || isRequesting}>
              {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("sendRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function DocumentSection({
  headingId,
  title,
  description,
  emptyLabel,
  children,
}: {
  headingId: string
  title: string
  description: string
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div>
        <h3 id={headingId} className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {children ?? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>}
        </CardContent>
      </Card>
    </section>
  )
}
