"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, ChevronDown, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ApiMatter } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const STAGES = ["Intake", "Active", "Discovery", "Negotiation", "Closing", "Closed"] as const

interface MatterStageDetailsProps {
  matter: ApiMatter
  activeStage: string
  canEdit: boolean
  updatingStage: boolean
  onStageChange: (stage: string) => void
}

function useMatterStageLabels() {
  const t = useTranslations("matters")
  const stageLabel = (stage: string) =>
    t(`pipelineStages.${stage}` as "pipelineStages.Intake")

  return { t, stageLabel }
}

export function MatterStagePipelineCard({
  activeStage,
  canEdit,
  updatingStage,
  onStageChange,
}: Pick<MatterStageDetailsProps, "activeStage" | "canEdit" | "updatingStage" | "onStageChange">) {
  const { t, stageLabel } = useMatterStageLabels()

  return (
    <Collapsible asChild defaultOpen>
      <Card className="flex h-full flex-col">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${t("stage_pipeline")}: ${stageLabel(activeStage)}`}
          >
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">{t("stage_pipeline")}</span>
              <span className="mt-1 block font-semibold">{stageLabel(activeStage)}</span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {STAGES.map((stage) => {
                const isCurrent = stage === activeStage
                return (
                  <Button
                    key={stage}
                    type="button"
                    size="sm"
                    variant={isCurrent ? "default" : "outline"}
                    disabled={!canEdit || updatingStage || isCurrent}
                    onClick={() => onStageChange(stage)}
                    aria-label={t("move_to_stage", { stage: stageLabel(stage) })}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn("h-8 shrink-0 text-xs", !canEdit && !isCurrent && "opacity-60")}
                  >
                    {isCurrent && updatingStage ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : isCurrent ? (
                      <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    ) : null}
                    {stageLabel(stage)}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function MatterDetailsCard({ matter }: Pick<MatterStageDetailsProps, "matter">) {
  const { t } = useMatterStageLabels()
  const summaryLabel = matter.client?.name ?? matter.caseNumber ?? matter.title
  const details = [
    { label: t("status_2"), value: matter.status },
    { label: t("practice_area"), value: matter.practiceArea },
    { label: t("matter_type"), value: matter.matterType },
    { label: t("jurisdiction_2"), value: matter.jurisdiction },
    { label: t("country"), value: matter.countryCode },
  ].filter((detail) => detail.value)

  return (
    <Collapsible asChild>
      <Card className="flex h-full flex-col">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t("matter_details")}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted-foreground">{t("matter_details")}</span>
              <span className="mt-1 block line-clamp-2 break-words font-semibold leading-snug">
                {summaryLabel}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            {matter.client?.name && (
              <div className="mb-3">
                <span className="text-xs text-muted-foreground">{t("client")}</span>
                {matter.clientId ? (
                  <Link
                    href={`/app/clients/${matter.clientId}`}
                    className="mt-0.5 block break-words text-sm font-medium text-primary hover:underline"
                  >
                    {matter.client.name}
                  </Link>
                ) : (
                  <p className="mt-0.5 break-words text-sm font-medium">{matter.client.name}</p>
                )}
              </div>
            )}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                  <dd className="mt-0.5 break-words text-sm">
                    {detail.label === t("status_2") ? (
                      <Badge variant="secondary">{detail.value}</Badge>
                    ) : (
                      detail.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function MatterStageDetails({
  matter,
  activeStage,
  canEdit,
  updatingStage,
  onStageChange,
}: MatterStageDetailsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MatterStagePipelineCard
        activeStage={activeStage}
        canEdit={canEdit}
        updatingStage={updatingStage}
        onStageChange={onStageChange}
      />
      <MatterDetailsCard matter={matter} />
    </div>
  )
}
