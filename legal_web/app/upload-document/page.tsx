"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { CountryCode, ConsumerDocument } from "@/lib/api/types"
import { listCases } from "@/lib/api/consumers"
import {
  getDocumentJobStatus,
  uploadConsumerDocument,
} from "@/lib/api/documents"
import { ApiClientError } from "@/lib/api/client"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { CheckCircle, FileText, Loader2, Upload } from "lucide-react"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"

const OCR_TERMINAL = new Set(["COMPLETED", "COMPLETE", "FAILED", "ERROR"])

function ocrBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED" || status === "COMPLETE") return "default"
  if (status === "FAILED" || status === "ERROR") return "destructive"
  if (status === "PROCESSING") return "secondary"
  return "outline"
}

export default function UploadDocumentPage() {
  const t = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { countryCode, setCountryCode, isLoading: countryLoading } = useDetectedCountry()
  const [selectedCaseId, setSelectedCaseId] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedDoc, setUploadedDoc] = useState<ConsumerDocument | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [ocrStatus, setOcrStatus] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["consumer-cases-upload", "api"],
    queryFn: () => listCases(),
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      setSelectedCaseId(cases[0].id)
    }
  }, [cases, selectedCaseId])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback(
    (documentId: string, pollJobId: string) => {
      stopPolling()
      setOcrStatus("PENDING")

      pollRef.current = setInterval(async () => {
        try {
          const status = await getDocumentJobStatus(pollJobId || documentId)
          const nextStatus = status.ocrStatus ?? status.status
          setOcrStatus(nextStatus)
          if (status.aiSummary) setAiSummary(status.aiSummary)
          if (status.document?.aiSummary) setAiSummary(status.document.aiSummary)
          if (OCR_TERMINAL.has(nextStatus.toUpperCase())) {
            stopPolling()
          }
        } catch {
          // Keep polling; job endpoint may lag behind upload
        }
      }, 2500)
    },
    [stopPolling],
  )

  const handleUpload = async () => {
    if (!file || !selectedCaseId) return
    setError(null)
    setUploading(true)
    setUploadedDoc(null)
    setOcrStatus(null)
    setAiSummary(null)

    try {
      const fileUrl = `https://storage.odaflow.local/consumer/${selectedCaseId}/${Date.now()}/${encodeURIComponent(file.name)}`
      const result = await uploadConsumerDocument({
        consumerCaseId: selectedCaseId,
        fileName: file.name,
        fileUrl,
        mimeType: file.type || undefined,
        fileSizeBytes: file.size,
        documentType: "CONSUMER_UPLOAD",
      })

      setUploadedDoc(result.document)
      const pollId = result.ocrJob.agentJobId ?? result.document.id
      setJobId(pollId)
      startPolling(result.document.id, pollId)
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Upload failed. Please try again."
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 max-w-2xl w-full">
        <div className="text-center mb-8">
          <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 mb-2">{t("upload_a_legal_document")}</h1>
          <p className="text-slate-600">
            Get a plain-language explanation of contracts, notices, and legal letters.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("document_upload")}</CardTitle>
            <CardDescription>
              Supported: PDF, DOCX, images. Sign in and link to a case for AI analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!authLoading && !isAuthenticated && (
              <p className="text-sm text-muted-foreground rounded-lg border p-3 bg-muted/30">
                <Link href="/auth" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>{" "}
                to upload and analyze documents.
              </p>
            )}

            <div className="space-y-2">
              <Label>{tAdmin("country")}</Label>
              <Select
                value={countryCode}
                onValueChange={(v) => setCountryCode(v as CountryCode)}
                disabled={countryLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={countryLoading ? "Detecting location..." : undefined} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{t("india")}</SelectItem>
                  <SelectItem value="US">{t("united_states")}</SelectItem>
                  <SelectItem value="KE">{t("kenya")}</SelectItem>
                  <SelectItem value="GB">{t("united_kingdom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAuthenticated && (
              <div className="space-y-2">
                <Label>{t("link_to_case")}</Label>
                <Select
                  value={selectedCaseId}
                  onValueChange={setSelectedCaseId}
                  disabled={casesLoading || cases.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={casesLoading ? "Loading cases..." : "Select a case"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cases.length === 0 && !casesLoading && (
                  <p className="text-xs text-muted-foreground">
                    No cases yet.{" "}
                    <Link href="/legal-issue-checker" className="text-primary hover:underline">
                      Create one with the issue checker
                    </Link>
                  </p>
                )}
              </div>
            )}

            <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary font-medium hover:underline">
                  Choose a file
                </span>
                <span className="text-muted-foreground">{t("or_drag_and_drop")}</span>
              </Label>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-3">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-3 bg-destructive/5">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="w-full sm:w-auto"
                disabled={!file || !selectedCaseId || !isAuthenticated || uploading}
                onClick={handleUpload}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Analyze
                  </>
                )}
              </Button>
              <Link href="/legal-issue-checker">
                <Button variant="outline" className="w-full sm:w-auto">
                  Or use Issue Checker
                </Button>
              </Link>
            </div>

            {uploadedDoc && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{uploadedDoc.fileName}</p>
                  {ocrStatus && (
                    <Badge variant={ocrBadgeVariant(ocrStatus)}>{ocrStatus}</Badge>
                  )}
                </div>
                {!OCR_TERMINAL.has((ocrStatus ?? "").toUpperCase()) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    OCR processing in progress...
                    {jobId && (
                      <span className="text-xs">(job {jobId.slice(0, 8)}…)</span>
                    )}
                  </div>
                )}
                {(ocrStatus === "COMPLETED" || ocrStatus === "COMPLETE") && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Analysis complete
                  </div>
                )}
                {aiSummary && (
                  <div className="text-sm whitespace-pre-wrap border-t pt-3">
                    <p className="font-medium mb-1">{t("ai_summary")}</p>
                    <p className="text-muted-foreground">{aiSummary}</p>
                    <LegalDisclaimer variant="compact" className="mt-3" />
                  </div>
                )}
                {selectedCaseId && (
                  <Link href={`/consumer/cases/${selectedCaseId}`}>
                    <Button variant="link" className="px-0 h-auto">
                      View case documents
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <CinematicFooter />
    </div>
  )
}
