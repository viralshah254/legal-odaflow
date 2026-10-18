"use client"
import { useTranslations } from "next-intl"

import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, FileText, Save } from "lucide-react"
import {
  updateLeadContext,
  createLeadDocumentUploadUrl,
  createLeadDocument,
  type LawyerLead,
  type LeadDocument,
} from "@/lib/api/marketplace"
import type { ConsumerDocument, ConsumerCase } from "@/lib/api/types"

interface LeadContextSectionProps {
  leadId: string
  lead: LawyerLead
  consumerCase: ConsumerCase | null
  leadDocuments: LeadDocument[]
  consumerDocuments: ConsumerDocument[]
  onUpdated: () => void
}

export function LeadContextSection({
  leadId,
  lead,
  consumerCase,
  leadDocuments,
  consumerDocuments,
  onUpdated,
}: LeadContextSectionProps) {
  const tCommon = useTranslations("common")
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState(lead.lawyerContextMarkdown ?? "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const saveContext = async () => {
    setSaving(true)
    try {
      await updateLeadContext(leadId, notes)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          const { uploadUrl, fileUrl, uploadHeaders } = await createLeadDocumentUploadUrl(leadId, file.name)
          if (!uploadUrl.startsWith("local://")) {
            await fetch(uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
                ...(uploadHeaders ?? {}),
              },
              body: file,
            })
          }
          await createLeadDocument(leadId, {
            fileName: file.name,
            fileUrl,
            mimeType: file.type || undefined,
            fileSizeBytes: file.size,
          })
        }
        await queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] })
        onUpdated()
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [leadId, onUpdated, queryClient],
  )

  return (
    <Card id="lead-case-context" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{tCommon("case_context")}</CardTitle>
        <CardDescription>
          Firm-private notes and documents — included in AI analysis runs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {consumerCase?.facts && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{tCommon("intake_facts_read-only")}</p>
            <p className="text-sm whitespace-pre-wrap">{consumerCase.facts}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="lawyer-context">{tCommon("counsel_notes")}</Label>
          <Textarea
            id="lawyer-context"
            rows={4}
            placeholder={tCommon("additional_facts_strategy_focus_client_instructions")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button size="sm" onClick={() => void saveContext()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save context
          </Button>
        </div>

        <div className="space-y-2">
          <Label>{tCommon("firm-private_documents")}</Label>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => void handleFileSelect(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Attach files
          </Button>

          <ul className="space-y-2">
            {leadDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.fileName}</span>
                </span>
                <Badge variant="outline">{doc.ocrStatus}</Badge>
              </li>
            ))}
            {consumerDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-2 bg-muted/20"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.fileName}</span>
                  <Badge variant="secondary" className="text-xs">
                    Client
                  </Badge>
                </span>
                <Badge variant="outline">{doc.ocrStatus ?? "—"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
