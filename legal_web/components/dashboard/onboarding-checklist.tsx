"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Circle, Loader2, X, PartyPopper } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listClients } from "@/lib/api/clients"
import { listTemplates, type ListTemplatesResponse } from "@/lib/api/templates"
import { listMatters } from "@/lib/api/matters"
import { getResearchHistory } from "@/lib/api/ai"
import { cn } from "@/lib/utils"

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
}

export function OnboardingChecklist({ solo = false }: { solo?: boolean }) {
  const t = useTranslations("dashboard.onboarding")
  const { activeTenant } = useTenant()
  const tenantId = activeTenant?.tenantId ?? ""
  const storageKey = `onboarding-dismissed-${tenantId}`
  const taskReviewStorageKey = `onboarding-task-reviewed-${tenantId}`

  const checklist = useMemo<ChecklistItem[]>(
    () => {
      const items: ChecklistItem[] = [
        {
          id: "aiSearch",
          label: t("aiSearchLabel"),
          description: t("aiSearchDescription"),
          href: "/app/research",
        },
        {
          id: "client",
          label: t("clientLabel"),
          description: t("clientDescription"),
          href: "/app/clients/new",
        },
        {
          id: "matter",
          label: t("matterLabel"),
          description: t("matterDescription"),
          href: "/app/matters/new",
        },
      ]
      if (!solo) {
        items.push({
          id: "template",
          label: t("templateLabel"),
          description: t("templateDescription"),
          href: "/app/templates",
        })
      }
      items.push({
        id: "task",
        label: t("taskLabel"),
        description: t("taskDescription"),
        href: "/app/tasks",
      })
      return items
    },
    [solo, t],
  )

  const [dismissal, setDismissal] = useState({
    tenantId: "",
    dismissed: false,
  })
  const [taskReview, setTaskReview] = useState({
    tenantId: "",
    reviewed: false,
  })
  const dismissed = dismissal.tenantId === tenantId && dismissal.dismissed
  const taskReviewed = taskReview.tenantId === tenantId && taskReview.reviewed

  useEffect(() => {
    if (!tenantId) return
    setDismissal({
      tenantId,
      dismissed: localStorage.getItem(storageKey) === "1",
    })
    setTaskReview({
      tenantId,
      reviewed: localStorage.getItem(taskReviewStorageKey) === "1",
    })
  }, [storageKey, taskReviewStorageKey, tenantId])

  const { data: clients = [], isLoading: loadingClients } = useApiData(
    ["onboarding-clients", tenantId],
    {
      apiFn: () => listClients(tenantId),
      enabled: !!tenantId && !dismissed,
      staleTime: 0,
    },
  )

  const { data: matters = [], isLoading: loadingMatters } = useApiData(
    ["dashboard-matters", tenantId],
    {
      apiFn: () => listMatters(tenantId),
      enabled: !!tenantId && !dismissed,
      staleTime: 0,
    },
  )

  const { data: templatesResult, isLoading: loadingTemplates } = useApiData<ListTemplatesResponse>(
    ["onboarding-templates", tenantId],
    {
      apiFn: () => listTemplates(tenantId),
      enabled: !!tenantId && !dismissed && !solo,
      staleTime: 0,
    },
  )

  const { data: researchHistory = [], isLoading: loadingResearch } = useApiData(
    ["onboarding-research-history", tenantId],
    {
      apiFn: () => getResearchHistory(tenantId),
      enabled: !!tenantId && !dismissed,
      staleTime: 0,
    },
  )

  const userTemplates =
    templatesResult?.templates?.filter(
      (template) => template.createdByUserId && !template.systemTemplateId,
    ) ?? []

  const completionMap: Record<string, boolean> = {
    aiSearch: researchHistory.length > 0,
    client: (clients as unknown[]).length > 0,
    matter: (matters as unknown[]).length > 0,
    template: userTemplates.length > 0,
    task: taskReviewed,
  }

  const loadingMap: Record<string, boolean> = {
    aiSearch: loadingResearch,
    client: loadingClients,
    matter: loadingMatters,
    template: !solo && loadingTemplates,
    task: false,
  }

  const pendingItems = checklist.filter((item) => !completionMap[item.id])
  const completedCount = checklist.length - pendingItems.length
  const allDone = pendingItems.length === 0
  const isLoading =
    loadingClients || loadingMatters || (!solo && loadingTemplates) || loadingResearch

  useEffect(() => {
    if (allDone && !isLoading && tenantId && !dismissed) {
      const timer = setTimeout(() => {
        localStorage.setItem(storageKey, "1")
        setDismissal({ tenantId, dismissed: true })
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [allDone, isLoading, tenantId, dismissed, storageKey])

  const handleDismiss = () => {
    if (tenantId) {
      localStorage.setItem(storageKey, "1")
    }
    setDismissal({ tenantId, dismissed: true })
  }

  const handleItemStart = (item: ChecklistItem) => {
    if (item.id !== "task" || !tenantId) return
    localStorage.setItem(taskReviewStorageKey, "1")
    setTaskReview({ tenantId, reviewed: true })
  }

  if (dismissed) return null
  if (!tenantId) return null

  if (allDone && !isLoading) {
    return (
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/8 to-emerald-500/5 motion-tab-enter">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
              <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">{t("allSetUp")}</p>
              <p className="text-xs text-muted-foreground">{t("allSetUpDescription")}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={handleDismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gradient-border animate-fade-in overflow-hidden">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{t("gettingStarted")}</CardTitle>
            <CardDescription className="mt-0.5 text-xs sm:text-sm">
              {t("gettingStartedDescription")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {!isLoading && (
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {t("progress", { completed: completedCount, total: checklist.length })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={handleDismiss}
              title={t("gettingStarted")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: isLoading ? "0%" : `${(completedCount / checklist.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
        {checklist.map((item, index) => {
          const isItemLoading = loadingMap[item.id]
          const isComplete = completionMap[item.id]
          const isNext = pendingItems[0]?.id === item.id
          const rowClassName = cn(
            "flex min-h-[58px] items-center gap-3 px-3 py-2.5 sm:px-4",
            index > 0 && "border-t border-border/50",
            isComplete && "bg-green-500/[0.04]",
            isNext && !isItemLoading && "bg-primary/[0.05]",
          )

          if (isComplete) {
            return (
              <div key={item.id} className={rowClassName}>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">{item.description}</p>
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => handleItemStart(item)}
              className={cn(
                rowClassName,
                "group transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              )}
            >
              <div className="shrink-0">
                {isItemLoading ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                  <Circle className={cn(
                    "h-4 w-4 transition-colors",
                    isNext ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{item.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-primary">
                {isNext && (
                  <span className="hidden text-xs font-semibold sm:inline">{t("start")}</span>
                )}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          )
        })}
        </div>
      </CardContent>
    </Card>
  )
}
