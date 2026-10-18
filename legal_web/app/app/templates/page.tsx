"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2, Search, Loader2, FileText, Upload, Sparkles, Library, Braces, GitBranch, ShieldCheck } from "lucide-react"
import {
  listTemplates,
  listTemplateLibrary,
  listPracticeAreas,
  provisionTemplateLibrary,
  createTemplate,
  deleteTemplate,
  checkTemplateNameExists,
  type ApiDocumentTemplate,
  type PracticeAreaOption,
  type SystemDocumentTemplate,
} from "@/lib/api/templates"
import { getMyProfile } from "@/lib/api/profile"
import { Switch } from "@/components/ui/switch"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { RichTextEditor } from "@/components/editor/rich-text-editor"
import { TemplateFileUpload } from "@/components/templates/template-file-upload"
import { pasteTextToHtml, suggestTitleFromPastedText } from "@/lib/templates/import-template-file"
import { format } from "date-fns"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useQueryClient } from "@tanstack/react-query"
import { ApiClientError } from "@/lib/api/client"
import { sanitizeDocumentHtml } from "@/lib/security/sanitize-html"

const NO_MATTER_VALUE = "__none__"

type TemplateCategory = "GENERAL_TEMPLATE" | "CLIENT_DOCUMENT" | "USER_TEMPLATE"

function isClientTemplate(template: ApiDocumentTemplate): boolean {
  return template.category === "CLIENT_DOCUMENT" || template.category === "CLIENT"
}

function isUserTemplate(template: ApiDocumentTemplate): boolean {
  return template.category === "USER_TEMPLATE"
}

function isGeneralTemplate(template: ApiDocumentTemplate): boolean {
  return !isClientTemplate(template) && !isUserTemplate(template)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export default function TemplatesPage() {
  const template = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tAdmin = useTranslations("admin")
  const tCommon = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tClients = useTranslations("clients")
  const router = useRouter()
  const { activeTenantId, activeTenant } = useTenant()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createCategory, setCreateCategory] = useState<TemplateCategory>("GENERAL_TEMPLATE")
  const [activeTab, setActiveTab] = useState<"general" | "user" | "client">("general")
  const [showAllPracticeAreas, setShowAllPracticeAreas] = useState(false)
  const [filterPracticeArea, setFilterPracticeArea] = useState<string>("")
  const [filterCountry, setFilterCountry] = useState<string>("")
  const [filterDocumentKind, setFilterDocumentKind] = useState<string>("")
  const [practiceAreas, setPracticeAreas] = useState<PracticeAreaOption[]>([])
  const [provisionNotice, setProvisionNotice] = useState<string | null>(null)
  const [provisioning, setProvisioning] = useState(false)

  const countryCode =
    filterCountry || activeTenant?.tenant.primaryCountry || "US"

  useEffect(() => {
    listPracticeAreas().then(setPracticeAreas).catch(() => {/* non-critical */})
    getMyProfile()
      .then((p) => {
        if (p.preferences?.primaryPracticeArea) {
          setFilterPracticeArea(p.preferences.primaryPracticeArea)
        }
      })
      .catch(() => {/* non-critical — profile unavailable */})
  }, [])

  const listQueryKey = [
    "templates",
    activeTenantId,
    filterPracticeArea,
    showAllPracticeAreas,
  ] as const

  const { data: listResult, isLoading, error: listError } = useApiData(
    listQueryKey,
    {
      apiFn: () =>
        // Do NOT filter by countryCode here — firm templates may have no country set
        // and would be invisible if we filtered strictly. Country filter applies to library only.
        listTemplates(activeTenantId!, {
          practiceArea: showAllPracticeAreas ? undefined : filterPracticeArea || undefined,
        }),
      enabled: !!activeTenantId,
    },
  )

  const templates = listResult?.templates ?? []

  useEffect(() => {
    if (listResult?.provisionedCount && listResult.provisionedCount > 0) {
      const label =
        practiceAreas.find((a) => a.slug === filterPracticeArea)?.label ??
        filterPracticeArea
      setProvisionNotice(
        `Loaded ${listResult.provisionedCount} starter template(s) for ${label || "your practice area"} (${countryCode}).`,
      )
    }
  }, [listResult?.provisionedCount, filterPracticeArea, practiceAreas, countryCode])

  const { data: library = [] } = useApiData<SystemDocumentTemplate[]>(
    ["template-library", activeTenantId, countryCode, filterPracticeArea, showAllPracticeAreas],
    {
      apiFn: () =>
        listTemplateLibrary(activeTenantId!, {
          countryCode,
          practiceArea: showAllPracticeAreas ? undefined : filterPracticeArea || undefined,
          allPracticeAreas: showAllPracticeAreas,
        }),
      enabled: !!activeTenantId && activeTab === "general",
    },
  )

  const libraryToAdd = library.filter((t) => !t.provisioned)

  const generalTemplates = templates.filter(isGeneralTemplate)
  const userTemplates = templates.filter(isUserTemplate)
  const clientTemplates = templates.filter(isClientTemplate)

  const documentKindOptions = useMemo(() => {
    const kinds = new Set<string>()
    for (const t of [...templates, ...library]) {
      if (t.documentKind) kinds.add(t.documentKind)
    }
    return [...kinds].sort()
  }, [templates, library])

  const filteredGeneralTemplates = generalTemplates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesKind = !filterDocumentKind || t.documentKind === filterDocumentKind
    return matchesSearch && matchesKind
  })
  const filteredUserTemplates = userTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const filteredClientTemplates = clientTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const automationStats = useMemo(() => {
    const variableTemplates = templates.filter((template) =>
      /\{\{[^}]+\}\}/.test(template.content ?? ""),
    ).length
    return [
      { label: "Templates", value: templates.length, helper: "Active firm forms", icon: FileText },
      { label: "Variables", value: variableTemplates, helper: "{{client.name}} ready", icon: Braces },
      { label: "Library clauses", value: library.length, helper: "Practice-area starters", icon: Library },
      { label: "Approval-ready", value: clientTemplates.length, helper: "Client docs for review", icon: ShieldCheck },
      { label: "Version paths", value: templates.length, helper: "Edit history entry points", icon: GitBranch },
    ]
  }, [clientTemplates.length, library.length, templates])

  const handleDelete = async (id: string) => {
    if (!activeTenantId || !confirm("Are you sure you want to delete this template?")) return
    await deleteTemplate(activeTenantId, id)
    queryClient.invalidateQueries({ queryKey: ["templates"] })
    queryClient.invalidateQueries({ queryKey: ["template-library"] })
  }

  const handleLoadStarters = async () => {
    if (!activeTenantId || !filterPracticeArea) return
    setProvisioning(true)
    try {
      const result = await provisionTemplateLibrary(activeTenantId, {
        practiceArea: filterPracticeArea,
        countryCode,
        limit: 5,
      })
      const label = practiceAreas.find((a) => a.slug === filterPracticeArea)?.label
      setProvisionNotice(
        `Added ${result.provisionedCount} template(s) for ${label ?? filterPracticeArea}.`,
      )
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      queryClient.invalidateQueries({ queryKey: ["template-library"] })
    } finally {
      setProvisioning(false)
    }
  }

  const handleAddFromLibrary = async (systemTemplateId: string) => {
    if (!activeTenantId) return
    await provisionTemplateLibrary(activeTenantId, { systemTemplateIds: [systemTemplateId] })
    queryClient.invalidateQueries({ queryKey: ["templates"] })
    queryClient.invalidateQueries({ queryKey: ["template-library"] })
    queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] })
  }

  const openCreateDialog = (category: TemplateCategory) => {
    setCreateCategory(category)
    setCreateDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" data-tour="templates-upload">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.templates")}</h1>
          <p className="text-muted-foreground">
            Upload Word files or build reusable document templates for your firm
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCreateDialog("CLIENT_DOCUMENT")}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Client Doc
          </Button>
          <Button variant="outline" onClick={() => openCreateDialog("USER_TEMPLATE")}>
            <Plus className="mr-2 h-4 w-4" />
            Add User Template
          </Button>
          <Button onClick={() => openCreateDialog("GENERAL_TEMPLATE")}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {provisionNotice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {provisionNotice}
        </div>
      )}

      {listError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3 text-sm text-destructive">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <span>Unable to load templates — {listError instanceof Error ? listError.message : "please retry"}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {automationStats.map(({ label, value, helper, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{helper}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search_templates")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">{tAdmin("country")}</Label>
            <Select value={countryCode} onValueChange={setFilterCountry}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">{tCommon("india")}</SelectItem>
                <SelectItem value="US">{tCommon("united_states")}</SelectItem>
                <SelectItem value="KE">{tCommon("kenya")}</SelectItem>
                <SelectItem value="GB">UK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("practice_area")}</Label>
            <Select
              value={filterPracticeArea || undefined}
              onValueChange={setFilterPracticeArea}
              disabled={showAllPracticeAreas}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder={t("all_areas")} />
              </SelectTrigger>
              <SelectContent>
                {practiceAreas.map((area) => (
                  <SelectItem key={area.slug} value={area.slug}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Document kind</Label>
            <Select
              value={filterDocumentKind || "__all__"}
              onValueChange={(v) => setFilterDocumentKind(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All kinds</SelectItem>
                {documentKindOptions.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="show-all-areas"
              checked={showAllPracticeAreas}
              onCheckedChange={setShowAllPracticeAreas}
            />
            <Label htmlFor="show-all-areas" className="text-sm cursor-pointer">
              Show all practice areas
            </Label>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "general" | "user" | "client")}>
        <TabsList>
          <TabsTrigger value="general">General Templates ({generalTemplates.length})</TabsTrigger>
          <TabsTrigger value="user">User Templates ({userTemplates.length})</TabsTrigger>
          <TabsTrigger value="client">Client Documents ({clientTemplates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          {libraryToAdd.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Library className="h-4 w-4" />
                  Template library
                </CardTitle>
                <CardDescription>
                  Starter templates for {countryCode}
                  {showAllPracticeAreas ? " (all practice areas)" : ""}. Add to your firm to edit and use.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {libraryToAdd.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3 flex flex-col gap-2"
                  >
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="flex gap-1 flex-wrap">
                      {item.documentKind && (
                        <Badge variant="default" className="text-xs">
                          {item.documentKind.replace(/_/g, " ")}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {practiceAreas.find((a) => a.slug === item.practiceArea)?.label ??
                          item.practiceArea}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.countryCode}
                      </Badge>
                      {item.jurisdiction && (
                        <Badge variant="outline" className="text-xs">
                          {item.jurisdiction}
                        </Badge>
                      )}
                      {item.conditionalFields && item.conditionalFields.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {item.conditionalFields.length} conditional{item.conditionalFields.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto"
                      onClick={() => void handleAddFromLibrary(item.id)}
                    >
                      Add to firm
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {filteredGeneralTemplates.length === 0 ? (
            <EmptyTemplatesState
              title={t("no_general_templates_yet")}
              description={
                filterPracticeArea
                  ? "Starter templates load on your first visit when a practice area is set in Profile. You can also load them manually."
                  : "Set your primary practice area in Profile, or upload a DOCX to create a template."
              }
              actionLabel={
                filterPracticeArea ? "Load starter templates" : "Create General Template"
              }
              onAction={() =>
                filterPracticeArea
                  ? void handleLoadStarters()
                  : openCreateDialog("GENERAL_TEMPLATE")
              }
              secondaryAction={
                filterPracticeArea
                  ? {
                      label: "Create General Template",
                      onAction: () => openCreateDialog("GENERAL_TEMPLATE"),
                    }
                  : undefined
              }
              loading={provisioning}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGeneralTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  practiceLabel={
                    template.practiceArea
                      ? practiceAreas.find((a) => a.slug === template.practiceArea)?.label
                      : undefined
                  }
                  onEdit={() => router.push(`/app/templates/${template.id}/edit`)}
                  onDelete={() => handleDelete(template.id)}
                  badge={template.source === "SYSTEM" ? "Library" : "General"}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="user" className="space-y-4 mt-6">
          {filteredUserTemplates.length === 0 ? (
            <EmptyTemplatesState
              title="No user templates yet"
              description="Paste or upload your own templates. They are shared firm-wide and appear in draft search."
              actionLabel="Add User Template"
              onAction={() => openCreateDialog("USER_TEMPLATE")}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUserTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  practiceLabel={
                    template.practiceArea
                      ? practiceAreas.find((a) => a.slug === template.practiceArea)?.label
                      : undefined
                  }
                  onEdit={() => router.push(`/app/templates/${template.id}/edit`)}
                  onDelete={() => handleDelete(template.id)}
                  badge="User"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="client" className="space-y-4 mt-6">
          {filteredClientTemplates.length === 0 ? (
            <EmptyTemplatesState
              title={t("no_client_documents_yet")}
              description={t("upload_client_templates_description")}
              actionLabel="Upload Client Document"
              onAction={() => openCreateDialog("CLIENT_DOCUMENT")}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClientTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => router.push(`/app/templates/${template.id}/edit`)}
                  onDelete={() => handleDelete(template.id)}
                  badge="Client"
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {createDialogOpen && (
        <CreateTemplateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          tenantId={activeTenantId}
          initialCategory={createCategory}
          countryCode={countryCode}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ["templates"] })
            queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] })
            setCreateDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}

function EmptyTemplatesState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  loading,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  secondaryAction?: { label: string; onAction: () => void }
  loading?: boolean
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onAction} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {actionLabel}
          </Button>
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onAction}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  badge,
  practiceLabel,
}: {
  template: ApiDocumentTemplate
  onEdit: () => void
  onDelete: () => void
  badge: string
  practiceLabel?: string
}) {
  const t = useTranslations("lawyer")
  const preview = stripHtml(template.content).slice(0, 120)

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {preview || "No preview available"}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1 shrink-0 items-end">
            <Badge variant="outline">{badge}</Badge>
            {practiceLabel && (
              <Badge variant="secondary" className="text-xs">
                {practiceLabel}
              </Badge>
            )}
            {template.documentKind && (
              <Badge variant="default" className="text-xs">
                {template.documentKind.replace(/_/g, " ")}
              </Badge>
            )}
            {template.countryCode && (
              <Badge variant="secondary" className="text-xs">
                {template.countryCode}
              </Badge>
            )}
            {template.jurisdiction && (
              <Badge variant="outline" className="text-xs">
                {template.jurisdiction}
              </Badge>
            )}
            {template.conditionalFields && template.conditionalFields.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {template.conditionalFields.length} conditional{template.conditionalFields.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {format(new Date(template.updatedAt), "MMM d, yyyy")}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("edit_template_2")}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("delete_template")}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  tenantId,
  initialCategory,
  countryCode,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string | null
  initialCategory: TemplateCategory
  countryCode?: string
  onSave: () => void
}) {
  const t = useTranslations("lawyer")
  const tBilling = useTranslations("lawyer")
  const tClients = useTranslations("lawyer")
  const tCommon = useTranslations("lawyer")
  const [name, setName] = useState("")
  const [category, setCategory] = useState<TemplateCategory>(initialCategory)
  const [clientId, setClientId] = useState("")
  const [matterId, setMatterId] = useState(NO_MATTER_VALUE)
  const [content, setContent] = useState("<p></p>")
  const [nameError, setNameError] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<"upload" | "paste">(
    initialCategory === "USER_TEMPLATE" ? "paste" : "upload",
  )
  const [pasteText, setPasteText] = useState("")
  const [practiceArea, setPracticeArea] = useState("")
  const [documentKind, setDocumentKind] = useState("")

  const { data: clients = [] } = useApiData(
    ["clients", tenantId],
    { apiFn: () => listClients(tenantId!), enabled: !!tenantId && open },
  )

  const { data: matters = [] } = useApiData(
    ["matters", tenantId],
    { apiFn: () => listMatters(tenantId!), enabled: !!tenantId && open },
  )

  const mattersForClient = useMemo(
    () => matters.filter((m) => m.clientId === clientId),
    [matters, clientId],
  )

  useEffect(() => {
    setCategory(initialCategory)
  }, [initialCategory])

  const resetForm = () => {
    setName("")
    setCategory(initialCategory)
    setClientId("")
    setMatterId(NO_MATTER_VALUE)
    setContent("<p></p>")
    setNameError("")
    setFormError(null)
    setImportedFileName(null)
    setInputMode(initialCategory === "USER_TEMPLATE" ? "paste" : "upload")
    setPasteText("")
    setPracticeArea("")
    setDocumentKind("")
  }

  const handleImport = (result: { html: string; fileName: string; suggestedName: string }) => {
    setContent(sanitizeDocumentHtml(result.html))
    setImportedFileName(result.fileName)
    if (!name.trim()) {
      setName(result.suggestedName)
    }
    setFormError(null)
  }

  const applyPasteText = () => {
    const trimmed = pasteText.trim()
    if (!trimmed) return
    setContent(pasteTextToHtml(trimmed))
    if (!name.trim()) {
      setName(suggestTitleFromPastedText(trimmed))
    }
    setFormError(null)
  }

  const handleSave = async () => {
    if (!name.trim() || !tenantId) {
      setNameError("Name is required")
      return
    }

    if (category === "CLIENT_DOCUMENT" && !clientId) {
      setFormError("Select a client for client documents")
      return
    }

    const plainContent = stripHtml(content)
    if (!plainContent) {
      setFormError("Add content by uploading a file or typing in the editor")
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const exists = await checkTemplateNameExists(tenantId, name.trim())
      if (exists.exists) {
        setNameError("A template with this name already exists")
        return
      }

      await createTemplate(tenantId, {
        name: name.trim(),
        content: sanitizeDocumentHtml(content),
        category,
        countryCode: countryCode || undefined,
        practiceArea: practiceArea || undefined,
        documentKind: documentKind || undefined,
      })
      resetForm()
      onSave()
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to create template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category === "CLIENT_DOCUMENT"
              ? "Upload Client Document"
              : category === "USER_TEMPLATE"
                ? "Add User Template"
                : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            {category === "USER_TEMPLATE"
              ? "Paste text or upload a file, add a title, then save to your firm library."
              : "Upload a Word or HTML file, then refine it in the editor before saving."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={inputMode === "upload" ? "default" : "outline"}
              onClick={() => setInputMode("upload")}
            >
              Upload file
            </Button>
            <Button
              type="button"
              size="sm"
              variant={inputMode === "paste" ? "default" : "outline"}
              onClick={() => setInputMode("paste")}
            >
              Paste text
            </Button>
          </div>

          {inputMode === "upload" ? (
            <TemplateFileUpload onImport={handleImport} />
          ) : (
            <div className="space-y-2">
              <Label>Paste template text</Label>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder="Paste your template here. Use blank lines between paragraphs."
                className="font-mono text-sm"
              />
              <Button type="button" variant="secondary" size="sm" onClick={applyPasteText} disabled={!pasteText.trim()}>
                Load pasted text into editor
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("template_name")}</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError("")
                }}
                placeholder={t("engagement_letter")}
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label>{tBilling("category")}</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as TemplateCategory)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL_TEMPLATE">{t("general_template")}</SelectItem>
                  <SelectItem value="USER_TEMPLATE">User template</SelectItem>
                  <SelectItem value="CLIENT_DOCUMENT">{t("client_document")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(category === "USER_TEMPLATE" || category === "GENERAL_TEMPLATE") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("practice_area")}</Label>
                <Input
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  placeholder="e.g. employment_labour"
                />
              </div>
              <div className="space-y-2">
                <Label>Document kind</Label>
                <Input
                  value={documentKind}
                  onChange={(e) => setDocumentKind(e.target.value)}
                  placeholder="e.g. employment_contract"
                />
              </div>
            </div>
          )}

          {category === "CLIENT_DOCUMENT" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("client_2")}</Label>
                <Select
                  value={clientId || undefined}
                  onValueChange={(value) => {
                    setClientId(value)
                    setMatterId(NO_MATTER_VALUE)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={tClients("selectClient")} /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <SelectItem value="__no_clients__" disabled>
                        No clients found
                      </SelectItem>
                    ) : (
                      clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {clientId && (
                <div className="space-y-2">
                  <Label>{tCommon("matter_optional")}</Label>
                  <Select value={matterId} onValueChange={setMatterId}>
                    <SelectTrigger><SelectValue placeholder={tCommon("select_matter")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_MATTER_VALUE}>{t("no_specific_matter")}</SelectItem>
                      {mattersForClient.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {importedFileName && (
            <div className="rounded-lg border bg-primary/5 px-3 py-2 text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Content loaded from {importedFileName}. Edit below before saving.
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("content_2")}</Label>
            <RichTextEditor content={content} onChange={setContent} placeholder={t("start_typing_or_upload_a_file_above")} tenantId={tenantId ?? undefined} />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon("cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
