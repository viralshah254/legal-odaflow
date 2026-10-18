"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Scale,
  AlertTriangle,
} from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  approveAiOutput,
  formatAiReviewTaskType,
  listAiReviewQueue,
  resolveAiReviewOpenHref,
  type PendingAiReviewItem,
} from "@/lib/api/ai-review"
import { useQueryClient } from "@tanstack/react-query"

function riskBadgeVariant(
  risk: string | null,
): "default" | "secondary" | "destructive" {
  if (risk === "CRITICAL" || risk === "HIGH") return "destructive"
  if (risk === "MEDIUM") return "secondary"
  return "default"
}

function ReviewRow({
  item,
  onSelect,
  onApprove,
  approving,
}: {
  item: PendingAiReviewItem
  onSelect: (item: PendingAiReviewItem) => void
  onApprove: (item: PendingAiReviewItem) => void
  approving: boolean
}) {
  const t = useTranslations("dashboard.aiReview")
  const author = item.authorName?.trim() || item.authorEmail || t("unknownAuthor")

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatAiReviewTaskType(item.taskType)}</Badge>
            {item.riskLevel && (
              <Badge variant={riskBadgeVariant(item.riskLevel)}>
                {item.riskLevel.replace(/_/g, " ")}
              </Badge>
            )}
            {!item.verified && (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("unverified")}
              </Badge>
            )}
          </div>
          <p className="font-medium line-clamp-2">{item.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{item.preview}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t("author")}: {author}</span>
        {item.matterTitle && (
          <span>
            {t("matter")}:{" "}
            <Link
              href={`/app/matters/${item.matterId}`}
              className="text-primary hover:underline"
            >
              {item.matterTitle}
            </Link>
          </span>
        )}
        {item.jurisdiction && <span>{t("jurisdiction")}: {item.jurisdiction}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onSelect(item)}>
          {t("preview")}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={resolveAiReviewOpenHref(item)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            {t("openWorkspace")}
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={() => onApprove(item)}
          disabled={approving}
        >
          {approving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          {t("markReviewed")}
        </Button>
      </div>
    </div>
  )
}

export default function AiReviewQueuePage() {
  const t = useTranslations("dashboard.aiReview")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<PendingAiReviewItem | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const { data: queue = [], isLoading, error, refetch } = useApiData(
    ["ai-review-queue", activeTenantId],
    {
      apiFn: () => listAiReviewQueue(activeTenantId ?? undefined),
      enabled: !!activeTenantId,
    },
  )

  const invalidateBriefCounts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["proactive-brief", activeTenantId] })
    void queryClient.invalidateQueries({ queryKey: ["ai-review-queue", activeTenantId] })
  }, [activeTenantId, queryClient])

  const handleApprove = useCallback(
    async (item: PendingAiReviewItem) => {
      if (!activeTenantId) return
      setApprovingId(item.id)
      try {
        await approveAiOutput(item.id, activeTenantId)
        if (selected?.id === item.id) setSelected(null)
        invalidateBriefCounts()
        await refetch()
      } finally {
        setApprovingId(null)
      }
    },
    [activeTenantId, invalidateBriefCounts, refetch, selected?.id],
  )

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
      <div className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              {t("title")}
            </h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {isLoading && <PageSkeleton rows={4} />}
        {error && (
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : t("loadError")}
          </p>
        )}
        {!isLoading && !error && queue.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        )}
        {!isLoading && !error && queue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("queueTitle", { count: queue.length })}</CardTitle>
              <CardDescription>{t("queueDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {queue.map((item) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  onSelect={setSelected}
                  onApprove={handleApprove}
                  approving={approvingId === item.id}
                />
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.title}</DialogTitle>
                  <DialogDescription>
                    {formatAiReviewTaskType(selected.taskType)} ·{" "}
                    {format(new Date(selected.createdAt), "PPpp")}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                  {selected.outputMarkdown || selected.preview}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" asChild>
                    <Link href={resolveAiReviewOpenHref(selected)}>
                      {t("openWorkspace")}
                    </Link>
                  </Button>
                  <Button
                    onClick={() => void handleApprove(selected)}
                    disabled={approvingId === selected.id}
                  >
                    {approvingId === selected.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    {t("markReviewed")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
