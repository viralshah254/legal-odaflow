"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createPortalDocumentRequest } from "@/lib/api/portal"
import { useTenant } from "@/lib/contexts/tenant-context"
import { FileUp } from "lucide-react"

interface RequestPortalDocumentDialogProps {
  matterId: string
  clientId?: string
  matterTitle: string
  /** Controlled mode: if provided, the built-in trigger button is hidden */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RequestPortalDocumentDialog({
  matterId,
  clientId,
  matterTitle,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RequestPortalDocumentDialogProps) {
  const t = useTranslations("portal")
  const tMatters = useTranslations("matters")
  const { activeTenantId } = useTenant()
  const [internalOpen, setInternalOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const handleSubmit = async () => {
    if (!activeTenantId || !title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createPortalDocumentRequest(activeTenantId, {
        matterId,
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      })
      setOpen(false)
      setTitle("")
      setDescription("")
      setDueDate("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileUp className="h-4 w-4 mr-2" />
            Request portal document
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("request_client_document")}</DialogTitle>
          <DialogDescription>
            Send a document request to the client portal for {matterTitle}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">{t("document_title")}</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("eg_signed_engagement_letter")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-description">{tMatters("instructions")}</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("what_should_the_client_upload")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-due">{t("due_date_optional")}</Label>
            <Input
              id="doc-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
