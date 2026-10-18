"use client"
import { useTranslations } from "next-intl"

import { useState, useRef, type ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  Clock,
  FileUp,
  Loader2,
  MoreHorizontal,
  Plus,
  Upload,
  Users,
  XCircle,
} from "lucide-react"
import { MatterWorkspaceNav } from "@/components/matters/matter-workspace-nav"
import { MatterInlineCopilot } from "@/components/matters/matter-inline-copilot"
import { uploadFileViaPresignedUrl, uploadTenantDocument } from "@/lib/api/documents"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { MatterIntelligenceSidebar } from "@/components/matter-intelligence/matter-intelligence-sidebar"
import type { ApiMatter } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { queryKeys } from "@/lib/api/query-keys"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShareMatterDialog } from "@/components/matters/share-matter-dialog"
import { TransferCaseDialog } from "@/components/matters/transfer-case-dialog"
import { RequestAssistanceDialog } from "@/components/matters/request-assistance-dialog"
import { RequestPortalDocumentDialog } from "@/components/portal/request-portal-document-dialog"
import { useRole } from "@/lib/contexts/role-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatterAccessLevel } from "@/lib/api/matter-access"
import { updateMatter } from "@/lib/api/matters"

interface MatterWorkspaceShellProps {
  matter: ApiMatter
  tenantId: string
  children: ReactNode
  /** The single page-specific action displayed beside Quick actions. */
  primaryAction?: ReactNode
  /** Overview already has its own contextual rail. */
  showIntelligenceSidebar?: boolean
  /** Additional query keys to invalidate after a document upload */
  uploadInvalidateKeys?: unknown[][]
}

function getRiskLabel(score: number | null | undefined, t: (key: string) => string): string {
  if (!score || score < 0.3) return t("low_risk")
  if (score < 0.6) return t("medium_risk")
  if (score < 0.8) return t("high_risk")
  return t("critical_risk")
}

function getRiskVariant(score?: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (!score || score < 0.3) return "secondary"
  if (score < 0.6) return "default"
  return "destructive"
}

export function MatterWorkspaceShell({
  matter,
  tenantId,
  children,
  primaryAction,
  showIntelligenceSidebar = true,
  uploadInvalidateKeys = [],
}: MatterWorkspaceShellProps) {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { currentRole } = useRole()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [assistanceDialogOpen, setAssistanceDialogOpen] = useState(false)
  const [portalDocOpen, setPortalDocOpen] = useState(false)
  const [closingMatter, setClosingMatter] = useState(false)

  const { data: accessInfo } = useApiData(
    ["matter-access", tenantId, matter.id],
    {
      apiFn: () => getMatterAccessLevel(tenantId, matter.id),
      enabled: !!tenantId && !!matter.id,
    },
  )

  const hasFullFirmAccess =
    currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER"
  const isOwner = accessInfo?.isOwner ?? hasFullFirmAccess
  const canEdit =
    isOwner || accessInfo?.accessLevel === "WRITE" || currentRole === "PARTNER_ADMIN"
  const canShare = isOwner || currentRole === "PARTNER_ADMIN"
  const canTransfer =
    currentRole === "PARTNER_ADMIN" || (currentRole === "ASSOCIATE" && isOwner)
  const canRequestAssistance =
    currentRole === "PARTNER_ADMIN" ||
    currentRole === "JUNIOR_PARTNER" ||
    currentRole === "ASSOCIATE"

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setUploading(true)
    setUploadFileName(file.name)
    try {
      const { fileUrl, fileName } = await uploadFileViaPresignedUrl(tenantId, file)
      await uploadTenantDocument(tenantId, {
        fileName,
        fileUrl,
        mimeType: file.type,
        matterId: matter.id,
        fileSizeBytes: file.size,
      })
      queryClient.invalidateQueries({ queryKey: ["matter-docs", tenantId, matter.id] })
      queryClient.invalidateQueries({ queryKey: ["matter-docs-diligence", tenantId, matter.id] })
      queryClient.invalidateQueries({
        queryKey: queryKeys.matters.documents(tenantId, matter.id),
      })
      queryClient.invalidateQueries({ queryKey: ["diligence-jobs", tenantId, matter.id] })
      uploadInvalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
      toast({ title: t("document_uploaded"), description: fileName })
    } catch {
      toast({ title: t("upload_failed_short"), variant: "destructive" })
    } finally {
      setUploading(false)
      setUploadFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleCloseMatter = async () => {
    if (!tenantId || closingMatter) return
    if (!window.confirm(t("closeMatterBody"))) return
    setClosingMatter(true)
    try {
      await updateMatter(tenantId, matter.id, { status: "CLOSED", stage: "Closed" })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.detail(tenantId, matter.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.lists(tenantId),
        }),
      ])
      toast({ title: t("matterClosed") })
    } catch {
      toast({ title: t("failed_to_close_matter"), variant: "destructive" })
    } finally {
      setClosingMatter(false)
    }
  }

  const uploadAction = (
    <>
      {uploading && (
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Loader2 className="h-3 w-3 animate-spin" />
          {uploadFileName && (
            <span className="max-w-[120px] truncate">{uploadFileName}</span>
          )}
        </span>
      )}
      <Button
        size="sm"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="h-8 gap-1.5"
        aria-label={t("upload_doc")}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{t("upload_doc")}</span>
      </Button>
    </>
  )

  return (
    <div className="min-h-screen pb-24">
      {/* Top header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-2.5 space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/app/matters" className="hover:text-foreground transition-colors">
              {t("title")}
            </Link>
            <span>/</span>
            <Link
              href={`/app/matters/${matter.id}`}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {matter.title}
            </Link>
          </div>

          {/* Matter title row */}
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2 text-muted-foreground"
                asChild
              >
                <Link
                  href={`/app/matters/${matter.id}?hub=1`}
                  aria-label={t("workspace.backToMatter")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden lg:inline">{t("workspace.backToMatter")}</span>
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="font-semibold text-lg truncate">{matter.title}</h1>
                {matter.client?.name && matter.clientId && (
                  <Link
                    href={`/app/clients/${matter.clientId}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-foreground hover:bg-muted transition-colors shrink-0 hidden sm:inline-flex"
                  >
                    {matter.client.name}
                  </Link>
                )}
                {matter.client?.name && !matter.clientId && (
                  <span className="text-sm text-muted-foreground hidden sm:inline shrink-0">
                    · {matter.client.name}
                  </span>
                )}
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {matter.stage ?? t("kanbanStages.active")}
                </Badge>
                {matter.riskScore !== undefined && (
                  <Badge variant={getRiskVariant(matter.riskScore)} className="shrink-0 text-xs">
                    {getRiskLabel(matter.riskScore, t)}
                  </Badge>
                )}
              </div>
            </div>

            {/* One contextual action plus one grouped actions menu */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              />
              {primaryAction ?? uploadAction}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    aria-label={tCommon("quickActions")}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tCommon("quickActions")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canShare && (
                    <DropdownMenuItem onSelect={() => setShareDialogOpen(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      {t("share_action")}
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/time?matterId=${matter.id}`}>
                          <Clock className="mr-2 h-4 w-4" />
                          {tCommon("logTime")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/tasks/new?matterId=${matter.id}`}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("task_button")}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/app/research?matterId=${encodeURIComponent(matter.id)}`}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Research for this matter
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPortalDocOpen(true)}>
                    <FileUp className="mr-2 h-4 w-4" />
                    {t("request_portal_document")}
                  </DropdownMenuItem>
                  {canTransfer && (
                    <DropdownMenuItem onSelect={() => setTransferDialogOpen(true)}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      {t("transfer_action")}
                    </DropdownMenuItem>
                  )}
                  {canRequestAssistance && (
                    <DropdownMenuItem onSelect={() => setAssistanceDialogOpen(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      {t("assistance_action")}
                    </DropdownMenuItem>
                  )}
                  {canEdit && matter.status !== "CLOSED" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => void handleCloseMatter()}
                        disabled={closingMatter}
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {closingMatter ? t("closing_ellipsis") : t("closeMatter")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Workspace nav */}
          <MatterWorkspaceNav matterId={matter.id} matterType={matter.matterType} />
        </div>
      </div>

      {/* Page content */}
      <div className={cn("px-4 sm:px-6 py-6")}>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">{children}</div>
          {showIntelligenceSidebar && (matter.matterProfile || matter.matterTaskGraph) && (
            <MatterIntelligenceSidebar
              className="w-full lg:w-80 shrink-0"
              matterProfile={matter.matterProfile ?? undefined}
              matterGraph={matter.matterGraph ?? undefined}
              taskGraph={matter.matterTaskGraph ?? undefined}
            />
          )}
        </div>
      </div>

      {/* Sticky inline copilot */}
      <MatterInlineCopilot
        matterId={matter.id}
        clientId={matter.clientId ?? undefined}
      />

      <RequestPortalDocumentDialog
        matterId={matter.id}
        clientId={matter.clientId ?? undefined}
        matterTitle={matter.title}
        open={portalDocOpen}
        onOpenChange={setPortalDocOpen}
      />
      <TransferCaseDialog
        matterId={matter.id}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onTransferComplete={() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.matters.detail(tenantId, matter.id),
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.matters.lists(tenantId),
          })
          setTransferDialogOpen(false)
          toast({ title: t("case_transferred_success") })
        }}
      />
      <RequestAssistanceDialog
        matterId={matter.id}
        open={assistanceDialogOpen}
        onOpenChange={setAssistanceDialogOpen}
        onRequestComplete={() => {
          queryClient.invalidateQueries({
            queryKey: ["assistance", tenantId, matter.id],
          })
          setAssistanceDialogOpen(false)
          toast({ title: t("assistance_request_submitted") })
        }}
      />
      <ShareMatterDialog
        matterId={matter.id}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onShareComplete={() => {}}
      />
    </div>
  )
}
