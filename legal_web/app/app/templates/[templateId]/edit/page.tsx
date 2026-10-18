"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor } from "@/components/editor/rich-text-editor"
import { ClauseComparePanel } from "@/components/editor/clause-compare-panel"
import { TemplateFileUpload } from "@/components/templates/template-file-upload"
import { getTemplate, updateTemplate, checkTemplateNameExists } from "@/lib/api/templates"
import { assembleTemplatePreview } from "@/lib/api/document-automation"
import { sanitizeDocumentHtml } from "@/lib/security/sanitize-html"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { ArrowLeft, Save, Loader2, Braces, Eye, GitCompare } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

const DEFAULT_CONDITIONAL_FIELDS = [
  "ipOwnership",
  "paymentSchedule",
  "disputeResolution",
  "ndaType",
  "probationPeriod",
  "nonCompete",
  "depositAmount",
  "breakClause",
  "paymentDemand",
]

export default function EditTemplatePage() {
  const t = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const params = useParams()
  const templateId = params.templateId as string
  const { activeTenantId } = useTenant()
  const [clauseComparePanelOpen, setClauseComparePanelOpen] = useState(false)
  const [selectedClause, setSelectedClause] = useState("")

  const { data: template, isLoading } = useApiData(
    ["template", activeTenantId, templateId],
    {
      apiFn: () => getTemplate(activeTenantId!, templateId),
      enabled: !!activeTenantId && !!templateId,
    },
  )

  const [name, setName] = useState("")
  const [content, setContent] = useState("<p></p>")
  const [nameError, setNameError] = useState("")
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [conditionalField, setConditionalField] = useState("")
  const [conditionalValue, setConditionalValue] = useState("")
  const [conditionalOperator, setConditionalOperator] = useState<"equals" | "truthy" | "empty">("equals")
  const [previewAnswersJson, setPreviewAnswersJson] = useState('{\n  "ipOwnership": "client",\n  "paymentSchedule": "milestone"\n}')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const conditionalFieldOptions = useMemo(() => {
    const fromTemplate = template?.conditionalFields ?? []
    const merged = [...new Set([...fromTemplate, ...DEFAULT_CONDITIONAL_FIELDS])]
    return merged.sort()
  }, [template?.conditionalFields])

  useEffect(() => {
    if (template && !initialized) {
      setName(template.name)
      setContent(sanitizeDocumentHtml(template.content || "<p></p>"))
      setInitialized(true)
    }
  }, [template, initialized])

  const handleSave = async () => {
    if (!name.trim() || !activeTenantId || !template) {
      setNameError("Name is required")
      return
    }

    if (name !== template.name) {
      const exists = await checkTemplateNameExists(activeTenantId, name.trim(), templateId)
      if (exists.exists) {
        setNameError("A template with this name already exists")
        return
      }
    }

    setSaving(true)
    try {
      await updateTemplate(activeTenantId, templateId, {
        name: name.trim(),
        content: sanitizeDocumentHtml(content),
      })
      router.push("/app/templates")
    } catch (error: unknown) {
      setNameError(error instanceof Error ? error.message : "Failed to update template")
    } finally {
      setSaving(false)
    }
  }

  const insertConditionalClause = () => {
    if (!conditionalField) return
    const condition =
      conditionalOperator === "equals"
        ? `[[if:${conditionalField} == ${conditionalValue || "value"}]]`
        : `[[if:${conditionalField} ${conditionalOperator}]]`
    const block = `<p>${condition}Insert clause text here.[[/if]]</p>`
    setContent((prev) => `${prev}${block}`)
  }

  const handlePreviewAssemble = async () => {
    if (!activeTenantId) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const answers = JSON.parse(previewAnswersJson) as Record<string, string | boolean>
      const result = await assembleTemplatePreview(activeTenantId, templateId, answers, {
        clientName: "Sample Client Ltd",
        firmName: "Sample Law Firm",
        today: format(new Date(), "MMMM d, yyyy"),
      })
      setPreviewHtml(sanitizeDocumentHtml(result.body))
    } catch (error: unknown) {
      setPreviewError(error instanceof Error ? error.message : "Preview failed")
      setPreviewHtml(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("template_not_found")}</p>
            <Link href="/app/templates">
              <Button variant="outline" className="mt-4">{t("back_to_templates")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t("edit_template")}</h1>
            <p className="text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("template_details")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("template_name")}</Label>
                <Input id="name" value={name} onChange={(e) => { setName(e.target.value); setNameError("") }} />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("content")}</CardTitle>
              <CardDescription>{t("upload_a_new_file_to_replace_content_or_edit_directly")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TemplateFileUpload
                onImport={(result) => {
                  setContent(sanitizeDocumentHtml(result.html))
                  if (!name.trim() || name === template.name) {
                    setName(result.suggestedName)
                  }
                }}
              />
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      // Strip HTML tags to get plain clause text for comparison
                      const div = document.createElement("div")
                      div.innerHTML = content
                      setSelectedClause(div.textContent?.slice(0, 2000) ?? content.slice(0, 2000))
                      setClauseComparePanelOpen(true)
                    }}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare clause
                  </Button>
                </div>
                <RichTextEditor content={content} onChange={setContent} placeholder={t("start_typing")} tenantId={activeTenantId ?? undefined} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview with sample answers
              </CardTitle>
              <CardDescription>
                Assembles conditional clauses and merge fields using mock intake answers (saved content is not used until you save).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={previewAnswersJson}
                onChange={(e) => setPreviewAnswersJson(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={() => void handlePreviewAssemble()} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Assemble preview
              </Button>
              {previewError && <p className="text-sm text-destructive">{previewError}</p>}
              {previewHtml && (
                <div
                  className="rounded-md border p-4 prose prose-sm max-w-none dark:prose-invert max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(previewHtml) }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("template_info")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">{tCommon("category")}</Label>
                <div className="mt-1">
                  <Badge variant="outline">{template.category}</Badge>
                </div>
              </div>
              {template.documentKind && (
                <div>
                  <Label className="text-muted-foreground">Document kind</Label>
                  <div className="mt-1">
                    <Badge>{template.documentKind.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              )}
              {template.countryCode && (
                <div>
                  <Label className="text-muted-foreground">Country</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">{template.countryCode}</Badge>
                  </div>
                </div>
              )}
              {template.jurisdiction && (
                <div>
                  <Label className="text-muted-foreground">Jurisdiction</Label>
                  <p className="mt-1 text-sm">{template.jurisdiction}</p>
                </div>
              )}
              {template.conditionalFields && template.conditionalFields.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Conditional fields</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {template.conditionalFields.map((field) => (
                      <Badge key={field} variant="outline" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">{t("created_at")}</Label>
                <p className="mt-1 text-sm">{format(new Date(template.createdAt), "MMM d, yyyy")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t("last_updated")}</Label>
                <p className="mt-1 text-sm">{format(new Date(template.updatedAt), "MMM d, yyyy")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Braces className="h-4 w-4" />
                Conditional clause helper
              </CardTitle>
              <CardDescription>
                Insert <code className="text-xs">[[if:field == value]]</code> blocks driven by intake answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Field</Label>
                <Select value={conditionalField || undefined} onValueChange={setConditionalField}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionalFieldOptions.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Select
                  value={conditionalOperator}
                  onValueChange={(v) => setConditionalOperator(v as "equals" | "truthy" | "empty")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">equals (==)</SelectItem>
                    <SelectItem value="truthy">truthy</SelectItem>
                    <SelectItem value="empty">empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {conditionalOperator === "equals" && (
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={conditionalValue}
                    onChange={(e) => setConditionalValue(e.target.value)}
                    placeholder="e.g. client, milestone, yes"
                  />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={insertConditionalClause} disabled={!conditionalField}>
                Insert conditional block
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ClauseComparePanel
        open={clauseComparePanelOpen}
        onOpenChange={setClauseComparePanelOpen}
        clauseText={selectedClause}
        tenantId={activeTenantId ?? undefined}
      />
    </div>
  )
}
