"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, FileText, FolderOpen, Mic, MoreHorizontal, Pencil } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { getClient, getClientActivitySummary, updateClient } from "@/lib/api/clients"
import {
  archiveTenantDocument,
  getDocumentDownloadUrl,
  listTenantDocuments,
  uploadFileViaPresignedUrl,
  uploadTenantDocument,
  type ApiTenantDocument,
} from "@/lib/api/documents"
import {
  apiKycChecklistToDisplay,
  getKycChecklist,
  initializeKycForClient,
  updateKycDocument,
} from "@/lib/api/kyc"
import { listMatters } from "@/lib/api/matters"
import { listSavedResearch, type SavedResearchItem } from "@/lib/api/ai"
import { createPortalDocumentRequest, createPortalInvite } from "@/lib/api/portal"
import type { ApiClient, ApiMatter, UpdateClientRequest } from "@/lib/api/types"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { formatPhoneNumber, parsePhoneNumber } from "@/lib/geo/phone-codes"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useDefaultPhoneCountry } from "@/lib/hooks/use-default-phone-country"
import { getMatterDisplayTitle } from "@/lib/leads/lead-display-title"
import { queryKeys } from "@/lib/api/query-keys"
import {
  buildClientTabHref,
  CLIENT_TABS,
  getKycCompletionPercent,
  resolveClientTab,
  riskFromScore,
  type ClientTab,
} from "@/lib/clients/workspace-state"
import type { Meeting } from "@/lib/types/meetings"
import { useToast } from "@/hooks/use-toast"
import { ClientDocumentsPanel } from "@/components/clients/client-documents-panel"
import { ClientEditSheet } from "@/components/clients/client-edit-sheet"
import { ClientKycPanel, ClientOverviewKycPanel } from "@/components/clients/client-kyc-panel"
import { ClientMattersPanel } from "@/components/clients/client-matters-panel"
import { ClientMeetingsPanel } from "@/components/clients/client-meetings-panel"
import {
  ClientOverviewTab,
  type ClientActivityItem,
  type ClientNextAction,
} from "@/components/clients/client-overview-tab"
import {
  ClientPortalInviteAction,
  ClientPortalInviteBanner,
} from "@/components/clients/client-portal-invite"
import { ClientProfileAlert } from "@/components/clients/client-profile-alert"
import { ClientRecordHeader, type ClientRecordStatus } from "@/components/clients/client-record-header"
import {
  ClientSummaryMetrics,
  type ClientSummaryMetric,
} from "@/components/clients/client-summary-metrics"
import {
  ClientWorkspaceError,
  ClientWorkspaceLoading,
} from "@/components/clients/client-workspace-state"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { SavedResearchPanel } from "@/components/research/saved-research-panel"
import type { DashboardMatter } from "@/components/dashboard/matters-table-mini"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const CORPORATE_CLIENT_TYPES = new Set(["COMPANY", "NGO", "PARTNERSHIP"])

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }> | { clientId: string }
}) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const clientId = params instanceof Promise ? use(params).clientId : params.clientId
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { activeTenantId, activeTenant } = useTenant()
  const { countryCode: defaultPhoneCountry } = useDefaultPhoneCountry()
  const { currentRole } = useRole()
  const { setClientId } = useCopilotContext()
  const { toast } = useToast()

  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [recordingMeeting, setRecordingMeeting] = useState<Meeting | null>(null)
  const [clientMeetingsCount, setClientMeetingsCount] = useState(0)
  const [clientMeetingsLoading, setClientMeetingsLoading] = useState(true)
  const [clientMeetingsError, setClientMeetingsError] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<UpdateClientRequest>({})
  const [editPhoneCountry, setEditPhoneCountry] = useState("KE")
  const [editPhoneNational, setEditPhoneNational] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [kycInitializing, setKycInitializing] = useState(false)
  const [portalInviteLoading, setPortalInviteLoading] = useState(false)
  const [portalInviteUrl, setPortalInviteUrl] = useState("")
  const [documentUploading, setDocumentUploading] = useState(false)
  const [documentUploadProgress, setDocumentUploadProgress] = useState(0)
  const dismissKey = `dismissed_incomplete_${clientId}`
  const [incompleteDismissed, setIncompleteDismissed] = useState(() =>
    typeof window === "undefined" ? false : localStorage.getItem(dismissKey) === "1",
  )

  const requestedTab = searchParams.get("tab")
  const activeTab = resolveClientTab(requestedTab)

  const handleTabChange = (tab: string) => {
    if (!CLIENT_TABS.includes(tab as ClientTab) || tab === activeTab) return
    router.push(
      buildClientTabHref(clientId, tab as ClientTab, searchParams.toString()),
      { scroll: false },
    )
  }

  const {
    data: apiClient,
    isLoading,
    error,
    refetch: refetchClient,
  } = useApiData<ApiClient>(queryKeys.clients.detail(activeTenantId, clientId), {
    apiFn: () => getClient(activeTenantId!, clientId),
    enabled: Boolean(clientId && activeTenantId),
  })
  const { data: activitySummary } = useApiData(
    queryKeys.clients.activity(activeTenantId, clientId),
    {
      apiFn: () => getClientActivitySummary(activeTenantId!, clientId),
      enabled: Boolean(activeTenantId && clientId),
    },
  )
  const {
    data: kycChecklistApi,
    isLoading: kycLoading,
    error: kycError,
    refetch: refetchKyc,
  } = useApiData(queryKeys.clients.kyc(activeTenantId, clientId), {
    apiFn: () => getKycChecklist(activeTenantId!, clientId),
    enabled: Boolean(activeTenantId && clientId),
  })
  const {
    data: clientMattersApi = [],
    isLoading: mattersLoading,
    error: mattersError,
    refetch: refetchMatters,
  } = useApiData<ApiMatter[]>(queryKeys.clients.matters(activeTenantId, clientId), {
    apiFn: () => listMatters(activeTenantId!, { clientId }),
    enabled: Boolean(activeTenantId && clientId),
  })
  const {
    data: clientDocuments = [],
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useApiData<ApiTenantDocument[]>(queryKeys.clients.documents(activeTenantId, clientId), {
    apiFn: () => listTenantDocuments(activeTenantId!, { clientId }),
    enabled: Boolean(activeTenantId && clientId),
  })
  const {
    data: savedResearch = [],
    isLoading: savedResearchLoading,
  } = useApiData<SavedResearchItem[]>(
    queryKeys.research.saved(activeTenantId, { clientId }),
    {
      apiFn: () => listSavedResearch(activeTenantId!, { clientId }),
      enabled: Boolean(activeTenantId && clientId),
    },
  )
  const kycChecklist = useMemo(
    () => (kycChecklistApi ? apiKycChecklistToDisplay(kycChecklistApi) : undefined),
    [kycChecklistApi],
  )
  const kycNeedsSetup = Boolean(kycChecklistApi && kycChecklistApi.documents.length === 0)
  const clientOnlyDocumentCount = useMemo(
    () => clientDocuments.filter((document) => !document.matterId).length,
    [clientDocuments],
  )
  const clientMatters: DashboardMatter[] = useMemo(
    () =>
      clientMattersApi.map((matter) => ({
        id: matter.id,
        title: getMatterDisplayTitle(matter.title),
        ref: matter.caseNumber ?? matter.id.slice(0, 8),
        clientName: matter.client?.name ?? apiClient?.name ?? "—",
        stage: matter.stage ?? matter.status ?? "Active",
        risk: riskFromScore(matter.riskScore),
      })),
    [apiClient?.name, clientMattersApi],
  )
  const highRiskMatters = useMemo(
    () => clientMatters.filter((matter) => matter.risk === "High" || matter.risk === "Critical").length,
    [clientMatters],
  )
  const kycAttentionCount = useMemo(
    () =>
      (kycChecklist?.documents ?? []).filter(
        (document) => document.status === "MISSING" || document.status === "EXPIRED",
      ).length,
    [kycChecklist?.documents],
  )
  const completedKyc = useMemo(() => {
    return getKycCompletionPercent(kycChecklist?.documents)
  }, [kycChecklist?.documents])

  const missingProfileFields = useMemo(() => {
    if (!apiClient) return []
    const missing: string[] = []
    if (!apiClient.email) missing.push(t("email").toLocaleLowerCase())
    if (!apiClient.phone) missing.push(t("phone").toLocaleLowerCase())
    if (
      CORPORATE_CLIENT_TYPES.has(apiClient.type?.toUpperCase()) &&
      !apiClient.contactPeople?.length
    ) {
      missing.push(t("authorizedContact").toLocaleLowerCase())
    }
    return missing
  }, [apiClient, t])

  const summaryMetrics: ClientSummaryMetric[] = useMemo(
    () => [
      {
        key: "matters",
        label: t("stats.matters"),
        value: clientMatters.length,
        icon: FileText,
        tab: "matters",
        isLoading: mattersLoading,
        hasError: Boolean(mattersError),
      },
      {
        key: "risk",
        label: t("stats.highRisk"),
        value: highRiskMatters,
        icon: AlertTriangle,
        tab: "matters",
        isLoading: mattersLoading,
        hasError: Boolean(mattersError),
      },
      {
        key: "kyc",
        label: t("stats.kycComplete"),
        value: `${completedKyc}%`,
        icon: CheckCircle2,
        tab: "kyc",
        isLoading: kycLoading,
        hasError: Boolean(kycError),
      },
      {
        key: "meetings",
        label: t("stats.meetings"),
        value: clientMeetingsCount,
        icon: Mic,
        tab: "meetings",
        isLoading: clientMeetingsLoading,
        hasError: clientMeetingsError,
      },
      {
        key: "files",
        label: t("stats.clientFiles"),
        value: clientOnlyDocumentCount,
        icon: FolderOpen,
        tab: "documents",
        isLoading: documentsLoading,
        hasError: Boolean(documentsError),
      },
    ],
    [
      clientMatters.length,
      clientMeetingsCount,
      clientOnlyDocumentCount,
      completedKyc,
      documentsError,
      documentsLoading,
      highRiskMatters,
      kycError,
      kycLoading,
      mattersError,
      mattersLoading,
      clientMeetingsLoading,
      clientMeetingsError,
      t,
    ],
  )

  const recentActivity: ClientActivityItem[] = useMemo(() => {
    const labels = {
      CLIENT_UPDATED: t("activity.profileUpdated"),
      MATTER_UPDATED: t("activity.matterUpdated"),
      DOCUMENT_ADDED: t("activity.documentAdded"),
      KYC_DOCUMENT_RECEIVED: t("activity.kycDocumentReceived"),
      MEETING_RECORDED: t("activity.meetingRecorded"),
    }
    return (activitySummary?.items ?? [])
      .map((item) => ({ ...item, title: labels[item.type] }))
      .filter((item) => !Number.isNaN(new Date(item.occurredAt).getTime()))
      .slice(0, 4)
  }, [activitySummary?.items, t])

  const nextAction: ClientNextAction | undefined = useMemo(() => {
    if (missingProfileFields.length) {
      return {
        title: t("nextAction.completeProfile"),
        description: t("nextAction.completeProfileDescription"),
        label: t("edit"),
        onClick: () => setEditOpen(true),
      }
    }
    if (!kycLoading && !kycError && (kycNeedsSetup || kycAttentionCount > 0)) {
      return {
        title: kycNeedsSetup ? t("nextAction.setupKyc") : t("nextAction.reviewKyc"),
        description: kycNeedsSetup
          ? t("nextAction.setupKycDescription")
          : t("nextAction.reviewKycDescription", { count: kycAttentionCount }),
        label: t("nextAction.openKyc"),
        onClick: () => handleTabChange("kyc"),
      }
    }
    if (!mattersLoading && !mattersError && highRiskMatters > 0) {
      return {
        title: t("nextAction.reviewRisk"),
        description: t("nextAction.reviewRiskDescription", { count: highRiskMatters }),
        label: t("nextAction.openMatters"),
        onClick: () => handleTabChange("matters"),
      }
    }
    if (!mattersLoading && !mattersError && clientMatters.length === 0) {
      return {
        title: t("nextAction.createMatter"),
        description: t("nextAction.createMatterDescription"),
        label: t("createMatter"),
        onClick: () => router.push(`/app/matters/new?clientId=${encodeURIComponent(clientId)}`),
      }
    }
    return undefined
  }, [
    clientId,
    clientMatters.length,
    highRiskMatters,
    kycAttentionCount,
    kycError,
    kycLoading,
    kycNeedsSetup,
    mattersError,
    mattersLoading,
    missingProfileFields.length,
    router,
    t,
  ])

  useEffect(() => {
    setClientId(clientId)
    return () => setClientId(undefined)
  }, [clientId, setClientId])
  useEffect(() => {
    if (!apiClient) return
    const fallbackCountry = apiClient.countryCode ?? activeTenant?.tenant.primaryCountry ?? "KE"
    const parsed = parsePhoneNumber(apiClient.phone ?? "", fallbackCountry)
    setEditPhoneCountry(parsed.countryCode)
    setEditPhoneNational(parsed.nationalNumber)
    setEditForm({
      name: apiClient.name,
      email: apiClient.email ?? "",
      phone: apiClient.phone ?? "",
      address: apiClient.address ?? "",
      type: apiClient.type as UpdateClientRequest["type"],
      countryCode: apiClient.countryCode ?? "",
      contactPeople: apiClient.contactPeople?.map((person) => ({ ...person })) ?? [],
    })
  }, [activeTenant?.tenant.primaryCountry, apiClient])

  const initializeKyc = async () => {
    if (!activeTenantId || !apiClient) return
    setKycInitializing(true)
    try {
      await initializeKycForClient(
        activeTenantId,
        clientId,
        apiClient.type,
        apiClient.countryCode ?? undefined,
      )
      await refetchKyc()
      toast({ title: t("kycChecklistReady") })
    } catch {
      toast({ title: t("kycInitFailed"), variant: "destructive" })
    } finally {
      setKycInitializing(false)
    }
  }

  const updateKyc = async (
    documentId: string,
    updates: Partial<{ status: string; fileUrl?: string }>,
  ) => {
    if (!activeTenantId || !kycChecklistApi) return
    const document = kycChecklistApi.documents.find((item) => item.id === documentId)
    if (!document) return
    await updateKycDocument(activeTenantId, clientId, document.docType, updates)
    await queryClient.invalidateQueries({
      queryKey: queryKeys.clients.kyc(activeTenantId, clientId),
    })
  }

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeTenantId) return
    if (!editForm.name?.trim()) {
      setEditError(t("nameRequired"))
      return
    }
    setEditLoading(true)
    setEditError(null)
    try {
      await updateClient(activeTenantId, clientId, {
        name: editForm.name.trim(),
        email: editForm.email?.trim() || undefined,
        phone: formatPhoneNumber(editPhoneCountry, editPhoneNational) || undefined,
        address: editForm.address?.trim() || undefined,
        type: editForm.type,
        countryCode: editForm.countryCode?.trim() || undefined,
        contactPeople: (editForm.contactPeople ?? [])
          .filter((person) => person.name.trim())
          .map((person) => ({
            name: person.name.trim(),
            role: person.role?.trim() || undefined,
            email: person.email?.trim() || undefined,
            phone: person.phone?.trim() || undefined,
          })),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(activeTenantId, clientId),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clients.activity(activeTenantId, clientId),
      })
      toast({ title: t("clientUpdated") })
      setEditOpen(false)
    } catch {
      setEditError(t("failedToUpdate"))
      toast({ title: t("failedToUpdateShort"), variant: "destructive" })
    } finally {
      setEditLoading(false)
    }
  }

  const createInvite = async () => {
    if (!activeTenantId) return
    setPortalInviteLoading(true)
    try {
      const invite = await createPortalInvite(activeTenantId, clientId)
      setPortalInviteUrl(invite.inviteUrl)
      try {
        await navigator.clipboard.writeText(invite.inviteUrl)
        toast({ title: t("portalInviteCreatedCopied") })
      } catch {
        toast({ title: t("portalInviteCreated") })
      }
    } catch {
      toast({ title: t("portalInviteFailed"), variant: "destructive" })
    } finally {
      setPortalInviteLoading(false)
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(portalInviteUrl)
      toast({ title: t("portalInviteCopied") })
    } catch {
      toast({ title: t("copyInviteFailed"), variant: "destructive" })
    }
  }

  const uploadDocument = async (file: File, documentType: string, matterId?: string) => {
    if (!activeTenantId) return false
    setDocumentUploading(true)
    setDocumentUploadProgress(0)
    try {
      const uploaded = await uploadFileViaPresignedUrl(
        activeTenantId,
        file,
        setDocumentUploadProgress,
      )
      await uploadTenantDocument(activeTenantId, {
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        mimeType: file.type || undefined,
        clientId,
        matterId,
        documentType: documentType || undefined,
        fileSizeBytes: file.size,
      })
      await refetchDocuments()
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clients.activity(activeTenantId, clientId),
      })
      toast({ title: t("documentUploaded") })
      return true
    } catch {
      toast({ title: t("documentUploadFailed"), variant: "destructive" })
      return false
    } finally {
      setDocumentUploading(false)
      setDocumentUploadProgress(0)
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!activeTenantId) return false
    try {
      await archiveTenantDocument(activeTenantId, documentId)
      await refetchDocuments()
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clients.activity(activeTenantId, clientId),
      })
      toast({ title: t("documentRemoved") })
      return true
    } catch {
      toast({ title: t("documentRemoveFailed"), variant: "destructive" })
      return false
    }
  }

  const openDocument = async (documentId: string, mode: "preview" | "download") => {
    if (!activeTenantId) return
    const previewWindow = mode === "preview" ? window.open("about:blank", "_blank") : null
    if (previewWindow) previewWindow.opener = null
    try {
      const download = await getDocumentDownloadUrl(activeTenantId, documentId)
      if (mode === "preview") {
        if (previewWindow) previewWindow.location.href = download.fileUrl
        else window.open(download.fileUrl, "_blank", "noopener,noreferrer")
      } else {
        const anchor = document.createElement("a")
        anchor.href = download.fileUrl
        anchor.download = download.fileName
        anchor.rel = "noopener"
        anchor.click()
      }
    } catch {
      previewWindow?.close()
      toast({ title: t("documentOpenFailed"), variant: "destructive" })
    }
  }

  const requestDocument = async (title: string, matterId?: string) => {
    if (!activeTenantId) return false
    try {
      await createPortalDocumentRequest(activeTenantId, { clientId, matterId, title })
      toast({ title: t("documentRequestSent") })
      return true
    } catch {
      toast({ title: t("documentRequestFailed"), variant: "destructive" })
      return false
    }
  }

  if (isLoading) {
    return <ClientWorkspaceLoading label={t("loadingClientRecord")} className="mx-auto max-w-7xl" />
  }
  if (error || !apiClient) {
    return (
      <div className="p-4 sm:p-6">
        <ClientWorkspaceError
          title={t("failedToLoadClient")}
          description={t("clientNotFoundOrNoAccess")}
          retryLabel={tc("retry")}
          onRetry={() => void refetchClient()}
        />
      </div>
    )
  }

  const clientTypeLabel = t(
    `types.${apiClient.type.toUpperCase()}` as
      | "types.INDIVIDUAL"
      | "types.COMPANY"
      | "types.NGO"
      | "types.PARTNERSHIP",
  )
  const profileStatus: ClientRecordStatus = missingProfileFields.length
    ? { label: t("profileIncomplete"), tone: "warning" }
    : { label: t("profileComplete"), tone: "success" }
  const kycStatus: ClientRecordStatus = kycLoading
    ? { label: t("kycChecking"), tone: "neutral" }
    : kycError
      ? { label: t("kycUnavailable"), tone: "neutral" }
      : kycNeedsSetup
        ? { label: t("kycNotSetUp"), tone: "warning" }
        : kycAttentionCount
          ? { label: t("kycNeedsAttention", { count: kycAttentionCount }), tone: "danger" }
          : { label: t("kycUpToDate"), tone: "success" }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {!incompleteDismissed ? (
        <ClientProfileAlert
          missingFields={missingProfileFields}
          onEdit={() => setEditOpen(true)}
          onDismiss={() => {
            localStorage.setItem(dismissKey, "1")
            setIncompleteDismissed(true)
          }}
        />
      ) : null}

      <ClientRecordHeader
        client={apiClient}
        clientTypeLabel={clientTypeLabel}
        profileStatus={profileStatus}
        kycStatus={kycStatus}
        className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6"
        secondaryActions={
          <>
            <ClientPortalInviteAction
              loading={portalInviteLoading}
              label={t("portalInvite")}
              onCreate={() => void createInvite()}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("edit")}
            </Button>
            <OpenCopilotButton />
          </>
        }
        mobileSecondaryActions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label={t("openClientActions")}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void createInvite()} disabled={portalInviteLoading}>
                  {t("portalInvite")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>{t("editClient")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <OpenCopilotButton />
          </div>
        }
      />

      <ClientPortalInviteBanner
        url={portalInviteUrl}
        title={t("portalInviteReady")}
        description={t("portalInviteSecurity")}
        inputLabel={t("portalInviteUrl")}
        copyLabel={tc("copy")}
        onCopy={() => void copyInvite()}
      />

      <ClientSummaryMetrics
        metrics={summaryMetrics}
        unavailableLabel={tc("unavailable")}
        loadingLabel={tc("loading")}
        openSectionLabel={(label) => t("openSection", { section: label })}
        onSelectTab={handleTabChange}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList
          className="h-auto max-w-full justify-start gap-1 overflow-x-auto"
          aria-label={t("workspaceSections")}
        >
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="kyc">{t("tabs.kycCompliance")}</TabsTrigger>
          <TabsTrigger value="matters">{t("tabs.matters")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tabs.documents")}</TabsTrigger>
          <TabsTrigger value="meetings">{t("tabs.meetings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ClientOverviewTab
            client={apiClient}
            clientTypeLabel={clientTypeLabel}
            onEditClient={() => setEditOpen(true)}
            onEditContacts={() => setEditOpen(true)}
            activityItems={recentActivity}
            nextAction={nextAction}
            kycSlot={
              <ClientOverviewKycPanel
                clientName={apiClient.name}
                checklist={kycChecklist}
                isLoading={kycLoading}
                hasError={Boolean(kycError)}
                needsSetup={kycNeedsSetup}
                onRetry={() => void refetchKyc()}
                onManage={() => handleTabChange("kyc")}
              />
            }
          />
          <div className="mt-6">
            <SavedResearchPanel
              items={savedResearch}
              loading={savedResearchLoading}
              title="Client legal research"
            />
          </div>
        </TabsContent>
        <TabsContent value="kyc" className="mt-6">
          <ClientKycPanel
            clientId={clientId}
            clientName={apiClient.name}
            checklist={kycChecklist}
            isLoading={kycLoading}
            hasError={Boolean(kycError)}
            isInitializing={kycInitializing}
            needsSetup={kycNeedsSetup}
            onRetry={() => void refetchKyc()}
            onInitialize={() => void initializeKyc()}
            onUpdate={updateKyc}
          />
        </TabsContent>
        <TabsContent value="matters" className="mt-6">
          <ClientMattersPanel
            clientId={clientId}
            matters={clientMattersApi}
            isLoading={mattersLoading}
            hasError={Boolean(mattersError)}
            onRetry={() => void refetchMatters()}
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <ClientDocumentsPanel
            documents={clientDocuments}
            matters={clientMattersApi}
            isLoading={documentsLoading}
            hasError={Boolean(documentsError)}
            isUploading={documentUploading}
            uploadProgress={documentUploadProgress}
            onRetry={() => void refetchDocuments()}
            onUpload={uploadDocument}
            onDelete={deleteDocument}
            onOpen={openDocument}
            onRequest={requestDocument}
          />
        </TabsContent>
        <TabsContent value="meetings" className="mt-6">
          <ClientMeetingsPanel
            clientId={clientId}
            currentRole={currentRole}
            recordingMeeting={recordingMeeting}
            onRecordingMeetingChange={setRecordingMeeting}
            newMeetingOpen={newMeetingOpen}
            onNewMeetingOpenChange={setNewMeetingOpen}
            uploadOpen={uploadOpen}
            onUploadOpenChange={setUploadOpen}
            importOpen={importOpen}
            onImportOpenChange={setImportOpen}
            onTotalChange={(total, hasError) => {
              setClientMeetingsCount(total)
              setClientMeetingsLoading(false)
              setClientMeetingsError(Boolean(hasError))
            }}
          />
        </TabsContent>
      </Tabs>

      <ClientEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        form={editForm}
        setForm={setEditForm}
        phoneCountry={editPhoneCountry}
        setPhoneCountry={setEditPhoneCountry}
        phoneNational={editPhoneNational}
        setPhoneNational={setEditPhoneNational}
        preferredPhoneCountry={defaultPhoneCountry}
        loading={editLoading}
        error={editError}
        onSubmit={submitEdit}
      />
    </div>
  )
}
