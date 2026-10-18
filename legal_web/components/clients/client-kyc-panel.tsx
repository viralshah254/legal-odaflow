import Link from "next/link"
import { useTranslations } from "next-intl"
import { ListChecks } from "lucide-react"

import type { KycChecklist } from "@/lib/types/kyc"
import { KycChecklistCard } from "@/components/dashboard/kyc-checklist-card"
import { KycUploadTable } from "@/components/dashboard/kyc-upload-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClientWorkspaceError, ClientWorkspaceLoading } from "./client-workspace-state"

interface ClientKycPanelProps {
  clientId: string
  clientName: string
  checklist?: KycChecklist
  isLoading: boolean
  hasError: boolean
  isInitializing: boolean
  needsSetup: boolean
  onRetry: () => void
  onInitialize: () => void
  onUpdate: (docId: string, updates: Partial<{ status: string; fileUrl?: string }>) => Promise<void>
}

interface ClientOverviewKycPanelProps {
  clientName: string
  checklist?: KycChecklist
  isLoading: boolean
  hasError: boolean
  needsSetup: boolean
  onRetry: () => void
  onManage: () => void
}

export function ClientOverviewKycPanel({
  clientName,
  checklist,
  isLoading,
  hasError,
  needsSetup,
  onRetry,
  onManage,
}: ClientOverviewKycPanelProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")

  if (isLoading) return <ClientWorkspaceLoading label={t("loadingKyc")} compact />
  if (hasError) {
    return (
      <ClientWorkspaceError
        title={t("kycLoadFailed")}
        retryLabel={tc("retry")}
        onRetry={onRetry}
        compact
      />
    )
  }
  if (needsSetup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("kycDocuments")}</CardTitle>
          <CardDescription>{t("kycSetupDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onManage}>
            {t("openKycSetup")}
          </Button>
        </CardContent>
      </Card>
    )
  }
  return checklist ? (
    <KycChecklistCard checklist={checklist} clientName={clientName} onManageKyc={onManage} />
  ) : null
}

export function ClientKycPanel({
  clientId,
  clientName,
  checklist,
  isLoading,
  hasError,
  isInitializing,
  needsSetup,
  onRetry,
  onInitialize,
  onUpdate,
}: ClientKycPanelProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("kycDocuments")}</CardTitle>
            <CardDescription>{t("kycDocumentsDescription", { name: clientName })}</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="self-start" asChild>
            <Link href="/app/queues">
              <ListChecks className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("openComplianceQueue")}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ClientWorkspaceLoading label={t("loadingKyc")} compact />
        ) : hasError ? (
          <ClientWorkspaceError
            title={t("kycLoadFailed")}
            retryLabel={tc("retry")}
            onRetry={onRetry}
            compact
          />
        ) : checklist ? (
          <KycUploadTable
            clientId={clientId}
            documents={checklist.documents}
            onUpdate={onUpdate}
            onInitialize={needsSetup ? onInitialize : undefined}
            initializing={isInitializing}
          />
        ) : (
          <div className="py-8 text-center text-muted-foreground">{t("noKycChecklist")}</div>
        )}
      </CardContent>
    </Card>
  )
}
