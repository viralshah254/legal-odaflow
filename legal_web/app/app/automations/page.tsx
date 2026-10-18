"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  listBuiltInRecipes,
  resetAutomationDefaults,
  seedAutomationRecipes,
  updateAutomationRule,
  type AutomationAction,
  type AutomationRule,
  type BuiltInRecipe,
} from "@/lib/api/automations"
import {
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_TRIGGER_OPTIONS,
  AGENT_JOB_TYPE_LABELS,
  describeAction,
  describeConditions,
  describeRuleSummary,
  extractRecipeKey,
  formatRunStatus,
} from "@/lib/automations/catalog"
import { ApiClientError } from "@/lib/api/client"
import { AutomationFlowPreview } from "@/components/automations/automation-flow-preview"

function ruleMatchesRecipe(rule: AutomationRule, recipe: BuiltInRecipe): boolean {
  const key = extractRecipeKey(rule.conditions ?? undefined)
  return key === recipe.recipeKey || (rule.name === recipe.name && rule.trigger === recipe.trigger)
}

function RuleEditor({
  rule,
  onChange,
  showAdvanced,
  onToggleAdvanced,
}: {
  rule: Partial<AutomationRule> & { name: string; trigger: string }
  onChange: (next: Partial<AutomationRule>) => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
}) {
  const t = useTranslations("lawyer")
  const tIssueChecker = useTranslations("issueChecker")
  const actions = (rule.actions ?? []) as AutomationAction[]
  const conditions = (rule.conditions ?? {}) as Record<string, unknown>

  const updateAction = (index: number, patch: Partial<AutomationAction>) => {
    const next = actions.map((action, i) => (i === index ? { ...action, ...patch } : action))
    onChange({ actions: next })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>{t("rule_name")}</Label>
        <Input
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("eg_notify_assignee_on_new_task")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("when_this_happens")}</Label>
        <Select
          value={rule.trigger}
          onValueChange={(trigger) => onChange({ trigger })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTOMATION_TRIGGER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">{t("only_if_optional")}</p>
        {rule.trigger === "task.created" && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={Boolean(conditions.hasAssignee)}
              onCheckedChange={(checked) =>
                onChange({
                  conditions: { ...conditions, hasAssignee: checked || undefined },
                })
              }
            />
            Task has an assignee
          </label>
        )}
        {rule.trigger === "agent.completed" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t("agent_job_type")}</Label>
            <Select
              value={typeof conditions.jobType === "string" ? conditions.jobType : "any"}
              onValueChange={(value) =>
                onChange({
                  conditions: {
                    ...conditions,
                    jobType: value === "any" ? undefined : value,
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("any_agent_job")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("any_agent_job")}</SelectItem>
                {Object.entries(AGENT_JOB_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {rule.trigger === "invoice.overdue" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t("minimum_invoice_amount")}</Label>
            <Input
              type="number"
              min={0}
              value={typeof conditions.minAmount === "number" ? conditions.minAmount : ""}
              onChange={(e) =>
                onChange({
                  conditions: {
                    ...conditions,
                    minAmount: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              placeholder="1"
            />
          </div>
        )}
        {!["task.created", "agent.completed", "invoice.overdue"].includes(rule.trigger) && (
          <p className="text-sm text-muted-foreground">{t("no_extra_filters_for_this_trigger")}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("then_do_this")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = [...actions, { type: "send_notification" as const, title: "", body: "" }]
              onChange({ actions: next })
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add action
          </Button>
        </div>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_actions_configured_click_add_action_to_start")}</p>
        ) : (
          actions.map((action, index) => (
            <div key={index} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs text-muted-foreground w-20 shrink-0">{t("action_type")}</Label>
                  <Select
                    value={action.type}
                    onValueChange={(type) => updateAction(index, { type: type as AutomationAction["type"] })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_notification">{t("send_notification")}</SelectItem>
                      <SelectItem value="create_task">{t("create_task")}</SelectItem>
                      <SelectItem value="enqueue_agent_job">{t("run_ai_agent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    const next = actions.filter((_, i) => i !== index)
                    onChange({ actions: next })
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {action.type === "send_notification" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("notification_title")}</Label>
                    <Input
                      value={action.title ?? ""}
                      onChange={(e) => updateAction(index, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("message")}</Label>
                    <Input
                      value={action.body ?? ""}
                      onChange={(e) => updateAction(index, { body: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use placeholders like {"{{taskTitle}}"}, {"{{fileName}}"}, {"{{invoiceNumber}}"}.
                    </p>
                  </div>
                </>
              )}

              {action.type === "create_task" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("task_title")}</Label>
                    <Input
                      value={action.title ?? ""}
                      onChange={(e) => updateAction(index, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("priority")}</Label>
                    <Select
                      value={action.priority ?? "MEDIUM"}
                      onValueChange={(priority) => updateAction(index, { priority })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">{tIssueChecker("urgency.highShort")}</SelectItem>
                        <SelectItem value="MEDIUM">{tIssueChecker("urgency.mediumShort")}</SelectItem>
                        <SelectItem value="LOW">{tIssueChecker("urgency.lowShort")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {action.type === "enqueue_agent_job" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("agent_job_type")}</Label>
                    <Select
                      value={action.toolName ?? "SUMMARIZE_MATTER"}
                      onValueChange={(toolName) => updateAction(index, { toolName })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(AGENT_JOB_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The agent will run with matter context from the trigger event.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("after_completion")}</Label>
                    <Select
                      value={action.outputAction ?? "none"}
                      onValueChange={(outputAction) => updateAction(index, { outputAction })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("nothing_just_run_agent")}</SelectItem>
                        <SelectItem value="create_task">{t("create_task_from_findings")}</SelectItem>
                        <SelectItem value="send_notification">{t("notify_the_partner")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={onToggleAdvanced}>
        {showAdvanced ? (
          <>
            <ChevronUp className="mr-2 h-4 w-4" />
            Hide technical details
          </>
        ) : (
          <>
            <ChevronDown className="mr-2 h-4 w-4" />
            Show technical details (JSON)
          </>
        )}
      </Button>

      {showAdvanced && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("conditions_json")}</Label>
            <pre className="text-xs rounded-md border p-3 overflow-auto max-h-48 bg-muted/30">
              {JSON.stringify(rule.conditions ?? {}, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <Label>{t("actions_json")}</Label>
            <pre className="text-xs rounded-md border p-3 overflow-auto max-h-48 bg-muted/30">
              {JSON.stringify(rule.actions ?? [], null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AutomationsPage() {
  const t = useTranslations("lawyer")
  const tIssueChecker = useTranslations("issueChecker")
  const tAdmin = useTranslations("admin")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [draftRule, setDraftRule] = useState<Partial<AutomationRule> | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const { data: recipes = [], isLoading: recipesLoading } = useApiData(
    ["automation-recipes", activeTenantId],
    {
      apiFn: () => listBuiltInRecipes(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const {
    data: rules = [],
    isLoading: rulesLoading,
    error,
    refetch,
  } = useApiData(["automation-rules", activeTenantId], {
    apiFn: () => listAutomationRules(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  )

  useEffect(() => {
    if (!selectedRuleId && rules.length > 0) {
      setSelectedRuleId(rules[0].id)
    }
  }, [rules, selectedRuleId])

  useEffect(() => {
    if (selectedRule) {
      setDraftRule({ ...selectedRule })
      setShowAdvanced(false)
    } else {
      setDraftRule(null)
    }
  }, [selectedRule])

  const installedRecipeKeys = useMemo(
    () =>
      new Set(
        rules
          .map((rule) => extractRecipeKey(rule.conditions ?? undefined))
          .filter(Boolean) as string[],
      ),
    [rules],
  )

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["automation-rules", activeTenantId] })
    await refetch()
  }

  const handleInstallRecipes = async () => {
    if (!activeTenantId) return
    setBusy("install")
    setMessage(null)
    try {
      const result = await seedAutomationRecipes(activeTenantId)
      await invalidate()
      setMessage(
        result.installed > 0
          ? `Installed ${result.installed} recommended automation${result.installed === 1 ? "" : "s"}.`
          : "All recommended automations are already installed.",
      )
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Failed to install automations")
    } finally {
      setBusy(null)
    }
  }

  const handleResetDefaults = async () => {
    if (!activeTenantId) return
    setBusy("reset")
    setMessage(null)
    try {
      const result = await resetAutomationDefaults(activeTenantId)
      await invalidate()
      setResetOpen(false)
      setMessage(
        `Restored ${result.reset + result.installed} recommended automation${result.total === 1 ? "" : "s"} to factory settings.`,
      )
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Failed to reset automations")
    } finally {
      setBusy(null)
    }
  }

  const handleToggleRule = async (rule: AutomationRule, enabled: boolean) => {
    if (!activeTenantId) return
    setBusy(rule.id)
    try {
      await updateAutomationRule(activeTenantId, rule.id, { isEnabled: enabled })
      await invalidate()
    } finally {
      setBusy(null)
    }
  }

  const handleSaveRule = async () => {
    if (!activeTenantId || !draftRule?.name || !draftRule.trigger) return
    setBusy("save")
    setMessage(null)
    try {
      const payload = {
        name: draftRule.name,
        trigger: draftRule.trigger,
        conditions: draftRule.conditions ?? {},
        actions: (draftRule.actions ?? []) as AutomationAction[],
        isEnabled: draftRule.isEnabled ?? true,
      }

      if (selectedRule) {
        await updateAutomationRule(activeTenantId, selectedRule.id, payload)
      } else {
        const created = await createAutomationRule(activeTenantId, payload)
        setSelectedRuleId(created.id)
      }
      await invalidate()
      setMessage("Automation saved.")
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Failed to save automation")
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteRule = async (rule: AutomationRule) => {
    if (!activeTenantId) return
    if (!confirm(`Delete automation "${rule.name}"?`)) return
    setBusy(rule.id)
    try {
      await deleteAutomationRule(activeTenantId, rule.id)
      if (selectedRuleId === rule.id) setSelectedRuleId(null)
      await invalidate()
    } finally {
      setBusy(null)
    }
  }

  const handleNewRule = () => {
    setSelectedRuleId(null)
    setDraftRule({
      name: "Custom automation",
      trigger: "task.created",
      conditions: {},
      actions: [
        {
          type: "send_notification",
          title: "Automation alert",
          body: "Something happened in your firm workspace.",
          userIdField: "userId",
        },
      ],
      isEnabled: true,
    })
  }

  const loading = recipesLoading || rulesLoading

  if (!activeTenantId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your firm workspace is still loading.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap" data-tour="automations-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">{t("nav.automations")}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Set up simple when/then workflows — no coding required. Recommended recipes are
            pre-built and wired to tasks, matters, documents, AI agents, and billing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setResetOpen(true)} disabled={busy === "reset"}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Revert to defaults
          </Button>
          <Link href="/app/agents">
            <Button variant="outline">
              <Bot className="mr-2 h-4 w-4" />
              Agent Command Center
            </Button>
          </Link>
        </div>
      </div>

      {message && (
        <p className="text-sm rounded-lg border border-primary/30 bg-primary/5 p-3">{message}</p>
      )}
      {error && (
        <p className="text-sm rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
          {error.message}
        </p>
      )}

      <Card data-tour="automations-recipes">
        <CardHeader>
          <CardTitle>Recommended Recipes</CardTitle>
          <CardDescription>
            One-click recipes that are tested and connected to your firm data. Install any you
            haven&apos;t set up yet, or revert all to factory settings anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleInstallRecipes()} disabled={busy === "install"}>
              {busy === "install" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Install recommended automations
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recipes.map((recipe) => {
              const matchedRule = rules.find((rule) => ruleMatchesRecipe(rule, recipe))
              const installed = installedRecipeKeys.has(recipe.recipeKey) || !!matchedRule
              const lastRun = matchedRule?.runs?.[0]
              const hasRan = lastRun !== undefined

              let badgeLabel = installed ? "Installed" : "Available"
              let badgeVariant: "default" | "outline" | "secondary" | "destructive" = installed ? "default" : "outline"
              if (installed && hasRan) {
                if (lastRun.status === "COMPLETED") {
                  badgeLabel = "Active & ran"
                  badgeVariant = "default"
                } else if (lastRun.status === "FAILED") {
                  badgeLabel = "Last run failed"
                  badgeVariant = "destructive"
                }
              }

              return (
                <div key={recipe.recipeKey} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{recipe.name}</p>
                    <Badge variant={badgeVariant}>
                      {badgeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{recipe.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {describeRuleSummary(
                      recipe.trigger,
                      recipe.conditions,
                      recipe.actions as unknown as Array<Record<string, unknown>>,
                    )}
                  </p>
                  {installed && (
                    <p className="text-xs text-muted-foreground">
                      {hasRan
                        ? <>Last run: {formatRunStatus(lastRun.status)}{lastRun.status === "FAILED" && lastRun.error ? ` — ${lastRun.error}` : ""}</>
                        : "Never run"}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>{t("your_automations")}</CardTitle>
                <CardDescription>{t("turn_rules_on_or_off_and_pick_one_to_edit")}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleNewRule}>
                <Plus className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No automations yet. Install the recommended pack to get started.
                </p>
                <Button size="sm" onClick={() => void handleInstallRecipes()}>
                  Install recommended automations
                </Button>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-lg border p-3 space-y-2 transition ${
                    selectedRuleId === rule.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{rule.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {AUTOMATION_TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                        </p>
                      </div>
                      <Switch
                        checked={rule.isEnabled}
                        disabled={busy === rule.id}
                        onCheckedChange={(checked) => void handleToggleRule(rule, checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </button>

                  {rule.runs && rule.runs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {formatRunStatus(rule.runs[0].status)}
                      {rule.runs[0].error ? ` — ${rule.runs[0].error}` : ""}
                    </p>
                  )}

                  {!extractRecipeKey(rule.conditions ?? undefined) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      onClick={() => void handleDeleteRule(rule)}
                      disabled={busy === rule.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{selectedRule ? "Edit automation" : draftRule ? "New automation" : "Select an automation"}</CardTitle>
            <CardDescription>
              Use plain-language fields below. Technical JSON is optional under advanced details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftRule ? (
              <>
                <RuleEditor
                  rule={draftRule as AutomationRule}
                  onChange={(next) => setDraftRule((prev) => ({ ...prev, ...next }))}
                  showAdvanced={showAdvanced}
                  onToggleAdvanced={() => setShowAdvanced((v) => !v)}
                />

                <AutomationFlowPreview rule={draftRule as AutomationRule} />

                {selectedRule && (
                  <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                    <p className="text-xs font-medium">{tAdmin("summary")}</p>
                    <p className="text-sm">
                      {describeRuleSummary(
                        draftRule.trigger ?? selectedRule.trigger,
                        (draftRule.conditions ?? {}) as Record<string, unknown>,
                        (draftRule.actions ?? []) as unknown as Array<Record<string, unknown>>,
                      )}
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {describeConditions((draftRule.conditions ?? {}) as Record<string, unknown>).map(
                        (line) => (
                          <li key={line}>{line}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                <Button onClick={() => void handleSaveRule()} disabled={busy === "save"}>
                  {busy === "save" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save automation
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Select an automation from the list or install the recommended pack.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revert_recommended_automations_to_defaults")}</DialogTitle>
            <DialogDescription>
              This resets all built-in automations to their factory settings and turns them back on.
              Custom automations you created manually will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleResetDefaults()} disabled={busy === "reset"}>
              {busy === "reset" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Revert to defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
