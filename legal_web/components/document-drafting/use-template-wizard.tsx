"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { sanitizeDocumentHtml } from "@/lib/security/sanitize-html"
import {
  assembleDraftingSession,
  extractDraftingSessionFields,
  finalizeDraftingSession,
  generateDraftingSession,
  getDraftingSession,
  updateDraftingSessionFields,
  type DraftingSession,
} from "@/lib/api/drafting-session"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { DraftAccuracyPanel } from "@/components/drafting/accuracy/DraftAccuracyPanel"
import { DraftAuthorityInsights } from "@/components/drafting/draft-authority-insights"
import { DraftActionsToolbar } from "@/components/drafting/draft-actions-toolbar"
import {
  DEFAULT_KNOWLEDGE_SOURCES,
  KnowledgeSourcePicker,
  type KnowledgeSource,
} from "@/components/research/knowledge-source-picker"
import { DRAFT_CREDIT_COSTS } from "@/lib/credits/draft-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

type WizardStep = "confirm" | "intake" | "questions" | "preview" | "finalize"

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

interface UseTemplateWizardProps {
  tenantId: string
  sessionId: string
}

export function UseTemplateWizard({ tenantId, sessionId }: UseTemplateWizardProps) {
  const t = useTranslations("drafting")
  const queryClient = useQueryClient()
  const [step, setStep] = useState<WizardStep>("confirm")
  const [intakeText, setIntakeText] = useState("")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [previewHtml, setPreviewHtml] = useState("")
  const [verification, setVerification] = useState<DraftVerificationAudit | null>(null)
  const [clientId, setClientId] = useState("")
  const [matterId, setMatterId] = useState("")
  const [fileName, setFileName] = useState("")
  const [doneDocumentId, setDoneDocumentId] = useState<string | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(DEFAULT_KNOWLEDGE_SOURCES)

  const { gate: creditsGate, handleApiError } = useInsufficientCreditsGate({
    feature: "documentDraft",
    tenantId,
    requiredCredits: DRAFT_CREDIT_COSTS.EXTRACT_FIELDS,
  })

  const { data: session, isLoading } = useQuery({
    queryKey: ["drafting-session", tenantId, sessionId],
    queryFn: () => getDraftingSession(tenantId, sessionId),
  })

  const { data: clients } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: () => listClients(tenantId),
    enabled: step === "finalize",
  })

  const { data: matters } = useQuery({
    queryKey: ["matters", tenantId],
    queryFn: () => listMatters(tenantId),
    enabled: step === "finalize",
  })

  useEffect(() => {
    if (!session) return
    setIntakeText(session.sourceQuery ?? "")
    setFieldValues(session.fieldValues ?? {})
    if (session.workingHtml) {
      setPreviewHtml(sanitizeDocumentHtml(session.workingHtml))
    }
    if (session.templateName && !fileName) {
      setFileName(session.templateName.replace(/\s*\(draft session\)/i, ""))
    }
  }, [session, fileName])

  const extractMutation = useMutation({
    mutationFn: () => extractDraftingSessionFields(tenantId, sessionId, intakeText),
    onSuccess: (data) => {
      setExtractError(null)
      setFieldValues(data.fieldValues ?? {})
      void queryClient.invalidateQueries({ queryKey: ["drafting-session", tenantId, sessionId] })
      setStep("questions")
      setQuestionIndex(0)
    },
    onError: (err: unknown) => {
      const isCredErr = isInsufficientCreditsError(err)
      handleApiError(err, err instanceof Error ? err.message : "Field extraction failed.")
      if (!isCredErr) {
        setExtractError(err instanceof Error ? err.message : "Field extraction failed.")
      }
    },
  })

  const saveFieldsMutation = useMutation({
    mutationFn: (values: Record<string, string | boolean>) =>
      updateDraftingSessionFields(tenantId, sessionId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drafting-session", tenantId, sessionId] })
    },
  })

  const assembleMutation = useMutation({
    mutationFn: () => assembleDraftingSession(tenantId, sessionId),
    onSuccess: (data) => {
      const html = sanitizeDocumentHtml(data.workingHtml ?? data.assembled?.body ?? "")
      setPreviewHtml(html)
      setStep("preview")
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => generateDraftingSession(tenantId, sessionId, knowledgeSources),
    onSuccess: (data) => {
      setPreviewHtml(sanitizeDocumentHtml(data.draftHtml ?? data.workingHtml ?? ""))
      setVerification(data.verification ?? null)
      invalidateCreditWalletQueries(queryClient, tenantId)
      void queryClient.invalidateQueries({ queryKey: ["drafting-session", tenantId, sessionId] })
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizeDraftingSession(tenantId, sessionId, {
        clientId: clientId || undefined,
        matterId: matterId || undefined,
        fileName: fileName || undefined,
        actions: ["save"],
      }),
    onSuccess: (result) => {
      setDoneDocumentId(result.documentId)
      setStep("finalize")
    },
  })

  if (isLoading || !session) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const questions = session.unresolvedQuestions ?? []
  const currentQuestion = questions[questionIndex]
  const completion = session.completionScore ?? 0

  const knownFieldKeys = Object.keys(fieldValues).filter((k) => fieldValues[k]?.trim())

  return (
    <div className="space-y-6">
      {creditsGate}
      <div className="flex items-center gap-3">
        <Progress value={completion} className="flex-1 h-2" />
        <Badge variant="secondary">{completion}% {t("use.complete")}</Badge>
      </div>

      {session.jurisdictionMetadata && (
        <Card className="border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <CardTitle className="text-base">
                {session.jurisdictionMetadata.jurisdiction} drafting
              </CardTitle>
              <Badge variant="outline">
                {session.jurisdictionMetadata.advocateReviewed
                  ? "Advocate reviewed"
                  : "Advocate review pending"}
              </Badge>
            </div>
            <CardDescription>
              {session.jurisdictionMetadata.advocateReviewed
                ? "Review provenance is recorded for this template."
                : "This template is not advocate-reviewed. Verify current Kenyan law, court rules, and filing requirements before use."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            <div className="flex gap-2 text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Authority verification and filing-requirement verification are required for this
                draft.
              </span>
            </div>
            {session.jurisdictionMetadata.requiredAuthorityFields.length > 0 && (
              <div>
                <p className="font-medium">Required authority details</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {session.jurisdictionMetadata.requiredAuthorityFields.map((field) => (
                    <li key={field.id}>{field.label}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("use.confirmTitle")}</CardTitle>
            <CardDescription>{session.templateName ?? t("use.template")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {session.documentKind && <Badge>{session.documentKind.replace(/_/g, " ")}</Badge>}
              {session.countryCode && <Badge variant="outline">{session.countryCode}</Badge>}
            </div>
            {session.clauseCatalog?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t("use.clauses")}</p>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                  {session.clauseCatalog.map((c) => (
                    <li key={c.title}>
                      {c.mandatory ? "• " : "○ "}
                      {c.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={() => setStep("intake")} className="gap-2 w-full sm:w-auto">
              {t("use.continue")} <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "intake" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("use.intakeTitle")}</CardTitle>
            <CardDescription>{t("use.intakeSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={intakeText}
              onChange={(e) => setIntakeText(e.target.value)}
              rows={6}
              placeholder={t("use.intakePlaceholder")}
            />
            {knownFieldKeys.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-2">{t("use.extracted")}</p>
                <dl className="grid gap-1">
                  {knownFieldKeys.slice(0, 8).map((key) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground">{fieldLabel(key)}:</dt>
                      <dd>{fieldValues[key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void saveFieldsMutation.mutateAsync(fieldValues).then(() => setStep("questions"))
                }}
              >
                {t("use.skipExtract")}
              </Button>
              <Button
                className="gap-2"
                disabled={extractMutation.isPending || intakeText.trim().length < 10}
                onClick={() => extractMutation.mutate()}
              >
                {extractMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("use.extractFields")}
                <span className="ml-1 text-xs opacity-70">{DRAFT_CREDIT_COSTS.EXTRACT_FIELDS} cr</span>
              </Button>
            </div>
            {extractError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {extractError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "questions" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("use.questionsTitle")}</CardTitle>
            <CardDescription>
              {questions.length
                ? t("use.questionProgress", { current: questionIndex + 1, total: questions.length })
                : t("use.noQuestions")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion ? (
              <>
                <Label>{currentQuestion.text}</Label>
                {currentQuestion.type === "text" || !currentQuestion.options.length ? (
                  <Input
                    value={fieldValues[currentQuestion.id] ?? ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.options.map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        variant={fieldValues[currentQuestion.id] === opt ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setFieldValues((prev) => ({ ...prev, [currentQuestion.id]: opt }))
                        }
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={questionIndex === 0}
                    onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}
                  >
                    {t("use.back")}
                  </Button>
                  <Button
                    onClick={() => {
                      if (questionIndex < questions.length - 1) {
                        setQuestionIndex((i) => i + 1)
                      } else {
                        void saveFieldsMutation.mutateAsync(fieldValues).then(() => {
                          assembleMutation.mutate()
                        })
                      }
                    }}
                    disabled={assembleMutation.isPending}
                    className="gap-2"
                  >
                    {assembleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {questionIndex < questions.length - 1 ? t("use.next") : t("use.preview")}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={() => {
                  void saveFieldsMutation.mutateAsync(fieldValues).then(() => assembleMutation.mutate())
                }}
                disabled={assembleMutation.isPending}
                className="gap-2"
              >
                {assembleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("use.preview")}
              </Button>
            )}

            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("use.allFields")}</p>
              {Object.keys(fieldValues).map((key) => (
                <div key={key} className="grid sm:grid-cols-2 gap-2 items-center">
                  <Label className="text-xs">{fieldLabel(key)}</Label>
                  <Input
                    value={fieldValues[key] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("use.previewTitle")}</CardTitle>
            <CardDescription>Review and edit your document before saving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KnowledgeSourcePicker
              selected={knowledgeSources}
              onChange={setKnowledgeSources}
              countryCode={session.countryCode ?? undefined}
              compact
            />
            <div className="relative">
              {/* Editable document area */}
              <div
                contentEditable
                suppressContentEditableWarning
                className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 min-h-[220px] sm:min-h-[420px] max-h-[60vh] sm:max-h-[600px] overflow-y-auto bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                onBlur={(e) => {
                  const el = e.currentTarget
                  setPreviewHtml(el.innerHTML)
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Click anywhere in the document to edit directly.
              </p>
            </div>
            {previewHtml && (
              <DraftAuthorityInsights
                verification={verification}
                caseLawSelected={knowledgeSources.includes("case_law")}
                hasDraft={Boolean(previewHtml)}
                emptyStateActions={(
                  <DraftActionsToolbar
                    draftText={previewHtml.replace(/<[^>]+>/g, " ")}
                    documentKind={session.documentKind ?? session.templateName ?? "contract"}
                    rawFacts={session.sourceQuery ?? intakeText}
                    tenantId={tenantId}
                    countryCode={
                      session.countryCode === "US"
                        ? "US"
                        : session.countryCode === "KE"
                          ? "KE"
                          : "IN"
                    }
                    onEnriched={({ enrichedDraft }) => {
                      setPreviewHtml(sanitizeDocumentHtml(enrichedDraft))
                    }}
                  />
                )}
              />
            )}
            <DraftAccuracyPanel
              verification={verification}
              hideSimilarCases
              hideVerificationCard
            />
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
              <Button
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("use.polishAi")}
              </Button>
              <p className="text-xs text-muted-foreground sm:flex-1">
                {t("generateCreditCost", { credits: DRAFT_CREDIT_COSTS.FULL_DRAFT })}
              </p>
              <Button onClick={() => setStep("finalize")} className="gap-2 w-full sm:w-auto sm:ml-auto">
                {t("use.saveOptions")} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "finalize" && !doneDocumentId && (
        <Card>
          <CardHeader>
            <CardTitle>{t("use.finalizeTitle")}</CardTitle>
            <CardDescription>{t("use.finalizeSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("use.fileName")}</Label>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </div>
            <div>
              <Label>{t("use.linkClient")}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">{t("use.optional")}</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("use.linkMatter")}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
              >
                <option value="">{t("use.optional")}</option>
                {(matters ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <Button
              className="gap-2"
              disabled={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              {finalizeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("use.saveDocument")}
            </Button>
          </CardContent>
        </Card>
      )}

      {doneDocumentId && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span>{t("use.saved", { id: doneDocumentId })}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
