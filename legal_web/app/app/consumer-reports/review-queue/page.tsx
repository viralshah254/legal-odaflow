"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  listLawyerReviewQueue,
  type LawyerReviewQueueItem,
  type LawyerReviewSlaStatus,
} from "@/lib/api/consumer-reports"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Clock, Scale } from "lucide-react"

function slaVariant(status: LawyerReviewSlaStatus): "default" | "secondary" | "destructive" {
  if (status === "BREACHED") return "destructive"
  if (status === "AT_RISK") return "secondary"
  return "default"
}

function QueueRow({ item }: { item: LawyerReviewQueueItem }) {
  const t = useTranslations("lawyer")
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{item.consumerCase.title}</CardTitle>
          <Badge variant={slaVariant(item.sla.status)}>
            SLA {item.sla.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <CardDescription>
          {item.consumerCase.issueType} · {item.countryCode} ·{" "}
          {item.lawyerReviewStatus.replace(/_/g, " ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Consumer: {item.user.name ?? item.user.email}
        </p>
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Due {formatDistanceToNow(new Date(item.sla.dueAt), { addSuffix: true })}
          </span>
          <span>{item.sla.hoursElapsed}h elapsed / {item.sla.targetHours}h target</span>
          {item.riskLevel && <span>Risk: {item.riskLevel}</span>}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/leads?caseId=${item.consumerCase.id}`}>{t("open_case")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function ConsumerReportsReviewQueuePage() {
  const t = useTranslations("lawyer")
  const { data: queue = [], isLoading, error } = useApiData(
    ["consumer-reports-review-queue"],
    { apiFn: listLawyerReviewQueue },
  )

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
      <div className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Verified report review queue
            </h1>
            <p className="text-muted-foreground">
              Consumer reports awaiting lawyer verification (48h SLA)
            </p>
          </div>
        </div>

        {isLoading && <PageSkeleton rows={4} />}
        {error && (
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : "Failed to load queue"}
          </p>
        )}
        {!isLoading && !error && queue.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No reports pending verification.
            </CardContent>
          </Card>
        )}
        {queue.map((item) => (
          <QueueRow key={item.id} item={item} />
        ))}
      </div>
    </RoleGate>
  )
}
