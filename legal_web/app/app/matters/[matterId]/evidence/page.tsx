"use client"
import { useTranslations } from "next-intl"

import { useParams, useRouter } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { listEvidence, type EvidenceItem } from "@/lib/api/series-a"
import { listTenantDocuments } from "@/lib/api/documents"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ShieldCheck, ExternalLink, FileText, Plus } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default function MatterEvidencePage() {
  const t = useTranslations("matters")
  const tLawyer = useTranslations("lawyer")
  const params = useParams()
  const router = useRouter()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-evidence-shell", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: evidence = [], isLoading: evidenceLoading } = useApiData<EvidenceItem[]>(
    ["matter-evidence", activeTenantId, matterId],
    {
      apiFn: () => listEvidence(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: docs = [] } = useApiData(
    ["matter-docs-evidence", activeTenantId, matterId],
    {
      apiFn: () => listTenantDocuments(activeTenantId!, { matterId }),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  if (matterLoading) return <PageSkeleton />
  if (!matter || !activeTenantId) return null

  return (
    <MatterWorkspaceShell
      matter={matter}
      tenantId={activeTenantId}
      showIntelligenceSidebar={false}
      uploadInvalidateKeys={[["matter-docs-evidence", activeTenantId, matterId]]}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("evidenceVault")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("upload_evidence_description")}
            </p>
          </div>
          <Button size="sm" onClick={() => router.push(`/app/evidence?matterId=${matterId}`)}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {t("open_action")}
          </Button>
        </div>

        {evidenceLoading ? (
          <PageSkeleton />
        ) : evidence.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={tLawyer("noEvidenceYet") ?? "No evidence yet"}
            description={t("upload_evidence_description")}
          />
        ) : (
          <div className="space-y-3">
            {evidence.map((item) => {
              const linkedDoc = docs.find((d) => d.id === item.documentId)
              return (
                <Card key={item.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {linkedDoc && (
                          <Link href={linkedDoc.fileUrl ?? "#"} target="_blank">
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                              <FileText className="h-3.5 w-3.5" />
                              {t("document")}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </MatterWorkspaceShell>
  )
}
