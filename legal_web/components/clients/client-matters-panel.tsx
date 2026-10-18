"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpDown, CalendarClock, FilePlus2, FileText, Search } from "lucide-react"
import { useTranslations } from "next-intl"

import type { ApiMatter } from "@/lib/api/types"
import { getMatterDisplayTitle } from "@/lib/leads/lead-display-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClientWorkspaceEmpty,
  ClientWorkspaceError,
  ClientWorkspaceLoading,
} from "./client-workspace-state"

interface ClientMattersPanelProps {
  clientId: string
  matters: ApiMatter[]
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
}

export function ClientMattersPanel({
  clientId,
  matters,
  isLoading,
  hasError,
  onRetry,
}: ClientMattersPanelProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"updated" | "deadline" | "risk" | "title">("updated")

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return matters
      .map((matter) => {
        const deadlines = (matter.matterTaskGraph?.deadlines ?? [])
          .filter((deadline) => deadline.dueDate && !Number.isNaN(Date.parse(deadline.dueDate)))
          .sort((left, right) => Date.parse(left.dueDate!) - Date.parse(right.dueDate!))
        return {
          matter,
          title: getMatterDisplayTitle(matter.title),
          deadline: deadlines[0],
          openAction:
            matter.matterTaskGraph?.nextBestAction ??
            matter.matterTaskGraph?.recommendedActions?.[0],
          risk: matter.riskScore ?? 0,
        }
      })
      .filter(({ matter, title, openAction }) =>
        !normalizedSearch ||
        [title, matter.caseNumber, matter.stage, matter.status, matter.practiceArea, openAction]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch)),
      )
      .sort((left, right) => {
        if (sort === "title") return left.title.localeCompare(right.title)
        if (sort === "risk") return right.risk - left.risk
        if (sort === "deadline") {
          return (left.deadline?.dueDate ? Date.parse(left.deadline.dueDate) : Number.MAX_SAFE_INTEGER) -
            (right.deadline?.dueDate ? Date.parse(right.deadline.dueDate) : Number.MAX_SAFE_INTEGER)
        }
        return Date.parse(right.matter.updatedAt) - Date.parse(left.matter.updatedAt)
      })
  }, [matters, search, sort])

  return (
    <section className="space-y-3" data-tour="client-matters" aria-labelledby="client-matters-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="client-matters-heading" className="text-lg font-semibold">
            {t("relatedMatters")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("relatedMattersDescription")}</p>
        </div>
        <Button size="sm" className="self-start" asChild>
          <Link href={`/app/matters/new?clientId=${encodeURIComponent(clientId)}`}>
            <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("createMatter")}
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <ClientWorkspaceLoading label={t("loadingMatters")} compact />
      ) : hasError ? (
        <ClientWorkspaceError
          title={t("mattersLoadFailed")}
          retryLabel={tc("retry")}
          onRetry={onRetry}
          compact
        />
      ) : matters.length === 0 ? (
        <ClientWorkspaceEmpty
          icon={FileText}
          title={t("noMattersForClient")}
          description={t("noMattersForClientDescription")}
          action={
            <Button size="sm" asChild>
              <Link href={`/app/matters/new?clientId=${encodeURIComponent(clientId)}`}>
                <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("createMatter")}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchMatters")}
                aria-label={t("searchMatters")}
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(value: string) => setSort(value as typeof sort)}>
              <SelectTrigger aria-label={t("sortMatters")}>
                <ArrowUpDown className="mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">{t("sortRecentlyUpdated")}</SelectItem>
                <SelectItem value="deadline">{t("sortDeadline")}</SelectItem>
                <SelectItem value="risk">{t("sortRisk")}</SelectItem>
                <SelectItem value="title">{t("sortTitle")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rows.length === 0 ? (
            <ClientWorkspaceEmpty
              icon={Search}
              title={t("noMatchingMatters")}
              description={t("noMatchingMattersDescription")}
              action={<Button variant="outline" size="sm" onClick={() => setSearch("")}>{tc("clear_filters")}</Button>}
            />
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {rows.map(({ matter, title, deadline, openAction, risk }) => (
                  <article key={matter.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(7rem,0.7fr))]">
                    <div className="min-w-0">
                      <Link href={`/app/matters/${matter.id}`} className="font-medium text-primary hover:underline">
                        {title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {matter.caseNumber ?? matter.id.slice(0, 8)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm">
                        <span className="font-medium">{t("openAction")}:</span>{" "}
                        {openAction ?? t("noOpenAction")}
                      </p>
                    </div>
                    <MatterField label={t("stage")} value={matter.stage ?? matter.status} />
                    <MatterField label={t("owner")} value={t("unassigned")} />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("deadlineAndRisk")}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={risk >= 60 ? "destructive" : "outline"}>
                          {t("riskScore", { score: risk })}
                        </Badge>
                        {deadline?.dueDate ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            {new Date(deadline.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("noDeadline")}</span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  )
}

function MatterField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
