"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  KycDocument,
  KycDocStatus,
  getKycDocStatusLabel,
  getKycDocTypeLabel,
} from "@/lib/types/kyc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, CheckCircle2, FileDown, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadFileViaPresignedUrl } from "@/lib/api/documents"
import { updateKycDocument } from "@/lib/api/kyc"
import { useTenant } from "@/lib/contexts/tenant-context"

const KYC_STATUS_PRIORITY: Record<KycDocStatus, number> = {
  EXPIRED: 0,
  MISSING: 1,
  RECEIVED: 2,
  VERIFIED: 3,
}

interface KycUploadTableProps {
  clientId: string
  documents: KycDocument[]
  onUpdate: (docId: string, updates: Partial<KycDocument>) => void | Promise<void>
  onInitialize?: () => void
  initializing?: boolean
  className?: string
}

function statusLabel(status: KycDocStatus, t: ReturnType<typeof useTranslations<"dashboard.kyc">>) {
  const fallback = getKycDocStatusLabel(status)
  const key = `status${fallback}`
  try {
    return t.has(key) ? t(key) : fallback
  } catch {
    return fallback
  }
}

function toDateInputValue(value?: Date) {
  if (!value || Number.isNaN(new Date(value).getTime())) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export function KycUploadTable({
  clientId,
  documents,
  onUpdate,
  onInitialize,
  initializing = false,
  className,
}: KycUploadTableProps) {
  const t = useTranslations("dashboard.kyc")
  const { activeTenantId } = useTenant()
  const [uploading, setUploading] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingDocRef = useRef<KycDocument | null>(null)
  const translateOr = (key: string, fallback: string, values?: Record<string, string | number>) => {
    try {
      return t.has(key) ? t(key, values) : fallback
    } catch {
      return fallback
    }
  }

  const expiryValueFor = (doc: KycDocument) =>
    Object.prototype.hasOwnProperty.call(expiryDates, doc.id)
      ? expiryDates[doc.id]
      : toDateInputValue(doc.expiryDate)

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const doc = pendingDocRef.current
    if (!file || !doc || !activeTenantId) return

    setUploading(doc.id)
    setError(null)
    setAnnouncement("")

    try {
      const { fileUrl } = await uploadFileViaPresignedUrl(activeTenantId, file)
      const expiryDate = expiryValueFor(doc)
      await updateKycDocument(activeTenantId, clientId, doc.docType, {
        fileUrl,
        fileName: file.name,
        status: "pending",
        expiresAt: expiryDate || undefined,
      })
      await onUpdate(doc.id, {
        fileName: file.name,
        fileUrl,
        uploadedAt: new Date(),
        expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00`) : undefined,
        status: "RECEIVED",
      })
      setAnnouncement(
        translateOr(
          "uploadSucceeded",
          `${getKycDocTypeLabel(doc.docType)} uploaded and marked as received.`,
          { document: getKycDocTypeLabel(doc.docType) },
        ),
      )
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : translateOr("uploadFailed", "Upload failed"),
      )
    } finally {
      setUploading(null)
      pendingDocRef.current = null
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const startUpload = (doc: KycDocument) => {
    pendingDocRef.current = doc
    inputRef.current?.click()
  }

  const markVerified = async (doc: KycDocument) => {
    setVerifying(doc.id)
    setError(null)
    setAnnouncement("")
    try {
      const expiryDate = expiryValueFor(doc)
      if (expiryDate && expiryDate !== toDateInputValue(doc.expiryDate) && activeTenantId) {
        await updateKycDocument(activeTenantId, clientId, doc.docType, {
          expiresAt: expiryDate,
        })
      }
      await onUpdate(doc.id, { status: "VERIFIED" })
      setAnnouncement(
        translateOr(
          "verificationSucceeded",
          `${getKycDocTypeLabel(doc.docType)} marked as verified.`,
          { document: getKycDocTypeLabel(doc.docType) },
        ),
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : translateOr("verificationFailed", "Could not verify the document"),
      )
    } finally {
      setVerifying(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className={cn("text-center py-8 space-y-4", className)}>
        <p className="text-sm text-muted-foreground">
          {translateOr("noDocumentsYet", "No KYC documents have been set up yet.")}
        </p>
        {onInitialize ? (
          <Button onClick={onInitialize} disabled={initializing}>
            {initializing
              ? translateOr("settingUp", "Setting up…")
              : translateOr("setupKycChecklist", "Set up KYC checklist")}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={handleFileSelected}
        aria-label={translateOr("chooseKycFile", "Choose a KYC document to upload")}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {[...documents]
        .sort(
          (left, right) =>
            KYC_STATUS_PRIORITY[left.status] - KYC_STATUS_PRIORITY[right.status],
        )
        .map((doc) => {
        const documentLabel = getKycDocTypeLabel(doc.docType)
        const friendlyStatus = statusLabel(doc.status, t)
        const statusId = `kyc-status-${doc.id}`
        const expiryId = `kyc-expiry-${doc.id}`
        const busy = uploading === doc.id || verifying === doc.id
        const canUpload =
          doc.status === "MISSING" ||
          doc.status === "RECEIVED" ||
          doc.status === "EXPIRED"
        const uploadLabel =
          uploading === doc.id
            ? translateOr("uploading", "Uploading…")
            : translateOr(
                doc.fileName ? "replaceFile" : "upload",
                doc.fileName ? "Replace file" : "Upload",
              )
        return (
          <div
            key={doc.id}
            className={cn(
              "flex flex-wrap items-center gap-4 rounded-lg border p-4",
              doc.status === "MISSING"
                ? "border-red-500/50 bg-red-500/10"
                : doc.status === "EXPIRED"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : doc.status === "VERIFIED"
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-border/50 bg-muted/30",
            )}
            aria-describedby={statusId}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-sm font-medium">
                {documentLabel}
              </div>
              {doc.fileName ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-green-600" />
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline hover:text-primary"
                    >
                      {doc.fileName}
                      <FileDown aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only">
                        {translateOr("opensInNewTab", "(opens in a new tab)")}
                      </span>
                    </a>
                  ) : (
                    <span>{doc.fileName}</span>
                  )}
                  {doc.uploadedAt ? (
                    <span>
                      • {translateOr(
                        "uploaded",
                        `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}`,
                        { date: new Date(doc.uploadedAt).toLocaleDateString() },
                      )}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {translateOr("noFileUploaded", "No file uploaded")}
                </div>
              )}
              {canUpload && (
                <div className="mt-3 max-w-48">
                  <label htmlFor={expiryId} className="mb-1 block text-xs font-medium">
                    {translateOr("optionalExpiryDate", "Expiry date (optional)")}
                  </label>
                  <input
                    id={expiryId}
                    type="date"
                    value={expiryValueFor(doc)}
                    onChange={(event) =>
                      setExpiryDates((current) => ({
                        ...current,
                        [doc.id]: event.target.value,
                      }))
                    }
                    disabled={busy}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canUpload && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startUpload(doc)}
                  disabled={busy}
                  aria-label={translateOr(
                    doc.fileName ? "replaceDocument" : "uploadDocument",
                    `${uploadLabel} ${documentLabel}`,
                    { document: documentLabel },
                  )}
                >
                  <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
                  {uploadLabel}
                </Button>
              )}
              {doc.status === "RECEIVED" && (
                <Button
                  size="sm"
                  onClick={() => void markVerified(doc)}
                  disabled={busy}
                  aria-label={translateOr(
                    "markDocumentVerified",
                    `Mark ${documentLabel} as verified`,
                    { document: documentLabel },
                  )}
                >
                  <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />
                  {verifying === doc.id
                    ? translateOr("verifying", "Verifying…")
                    : translateOr("markVerified", "Mark verified")}
                </Button>
              )}
              <Badge
                id={statusId}
                variant={
                  doc.status === "VERIFIED"
                    ? "default"
                    : doc.status === "RECEIVED"
                      ? "secondary"
                      : doc.status === "EXPIRED"
                        ? "destructive"
                        : "outline"
                }
                className={cn(
                  doc.status === "VERIFIED" &&
                    "bg-green-500/10 text-green-700 dark:text-green-400",
                  doc.status === "RECEIVED" &&
                    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                )}
                aria-label={translateOr(
                  "documentStatus",
                  `KYC status: ${friendlyStatus}`,
                  { status: friendlyStatus },
                )}
              >
                {friendlyStatus}
              </Badge>
            </div>
          </div>
        )
        })}
    </div>
  )
}
