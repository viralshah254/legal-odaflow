"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { listTenantDocuments } from "@/lib/api/documents"
import { sendCopilotMessage } from "@/lib/api/copilot"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, Copy, FileText, AlertCircle, Check, Wand2, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import Link from "next/link"

const TASK_TYPES = [
  { value: "draft_document", label: "Draft a document", placeholder: "e.g. Draft a demand letter to the opposing party requesting settlement negotiations..." },
  { value: "legal_research", label: "Legal research", placeholder: "e.g. Research the applicable limitation periods for breach of contract in this jurisdiction..." },
  { value: "analyze_document", label: "Analyze document", placeholder: "e.g. Summarize the key obligations and risks in the uploaded contract..." },
  { value: "client_letter", label: "Client letter", placeholder: "e.g. Draft a status update letter explaining the current stage of their matter and next steps..." },
  { value: "case_strategy", label: "Case strategy advice", placeholder: "e.g. What are the strongest legal arguments given the facts of this case?" },
  { value: "identify_issues", label: "Identify legal issues", placeholder: "e.g. What are the key legal issues and potential claims arising from these facts?" },
]

export default function WorkbenchPage() {
  const tIssueChecker = useTranslations("issueChecker")
  const t = useTranslations("matters")
  const tErr = useTranslations("errors")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const { toast } = useToast()

  const [taskType, setTaskType] = useState("draft_document")
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [editableResult, setEditableResult] = useState("")

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-workbench", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: documents = [] } = useApiData(
    ["matter-docs", activeTenantId, matterId],
    {
      apiFn: () => listTenantDocuments(activeTenantId!, { matterId }),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const currentTask = TASK_TYPES.find((t) => t.value === taskType)

  const runAI = useCallback(async (customPrompt?: string) => {
    if (!activeTenantId || !matter) return
    const message = customPrompt ?? prompt.trim()
    if (!message) return

    setLoading(true)
    setError("")
    setResult(null)

    const taskLabel = currentTask?.label ?? taskType
    const systemContext = `You are a legal AI assistant helping a lawyer with: ${taskLabel}. Matter: "${matter.title}" (${matter.practiceArea ?? "General"}, ${matter.jurisdiction ?? ""}). Client: ${matter.client?.name ?? "Unknown"}. Stage: ${matter.stage ?? "Active"}. Summary: ${matter.factsSummary ?? "No summary available"}. Documents on file: ${documents.map((d) => d.fileName).join(", ") || "None"}.`

    try {
      const res = await sendCopilotMessage(activeTenantId, {
        message: `[${taskLabel}] ${message}`,
        context: {
          matterId,
          clientId: matter.clientId,
          selectedMatterId: matterId,
          systemContext,
          taskType,
        },
      })
      const content = res.message.content
      setResult(content)
      setEditableResult(content)
    } catch {
      setError("AI request failed. Please try again.")
      toast({ title: tErr("toast.aiRequestFailed"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeTenantId, matter, prompt, currentTask, taskType, documents, matterId, toast])

  // Auto-suggest on first load
  useEffect(() => {
    if (matter && !result && !loading) {
      const autoPrompt = `Based on the current state of this matter — "${matter.title}" for ${matter.client?.name ?? "the client"} — what are the 3 most important things I should work on right now? What documents should I prepare, what research is needed, and what actions would most advance this case?`
      runAI(autoPrompt)
    }
  }, [matter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (matterLoading || !matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MatterWorkspaceShell
      matter={matter}
      tenantId={activeTenantId!}
      showIntelligenceSidebar={false}
      uploadInvalidateKeys={[["matter-docs", activeTenantId, matterId]]}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Document context panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Matter context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {matter.client?.name && (
                <div>
                  <span className="text-muted-foreground">{tIssueChecker("client")}</span>
                  <span className="font-medium">{matter.client.name}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("stage_2")}</span>
                <Badge variant="secondary" className="text-xs">{matter.stage ?? "Active"}</Badge>
              </div>
              {matter.practiceArea && (
                <div>
                  <span className="text-muted-foreground">{t("practice_area")}</span>
                  <span>{matter.practiceArea}</span>
                </div>
              )}
              {matter.factsSummary && (
                <div className="pt-1 text-muted-foreground text-xs leading-relaxed border-t mt-2">
                  {matter.factsSummary}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2" aria-label={t("workspace.relatedMatterTools")}>
            <Button variant="outline" size="sm" className="justify-between" asChild>
              <Link href={`/app/matters/${matterId}/billing`}>
                {t("workspace.billing")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-between" asChild>
              <Link href={`/app/matters/${matterId}/court`}>
                {t("workspace.court")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Documents ({documents.length})</span>
                <span className="text-xs text-muted-foreground font-normal">{t("all_in_ai_context")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No documents yet — upload one using the button above to include it in AI analysis.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground group">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{doc.fileName}</span>
                      <span className="shrink-0 ml-auto text-[10px]">
                        {format(new Date(doc.createdAt), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: AI Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("workspace.quickAi")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("task_type")}</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("instructions")}</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={currentTask?.placeholder ?? "Describe what you need…"}
                  className="min-h-[100px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) {
                      e.preventDefault()
                      runAI()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("enter_to_run")}</p>
              </div>

              <Button
                onClick={() => runAI()}
                disabled={loading || !prompt.trim()}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result panel */}
          {(result !== null || loading) && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {loading ? "Generating…" : "Result"}
                  </CardTitle>
                  {!loading && result && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
                        {copied ? (
                          <><Check className="h-3 w-3" />{t("copied")}</>
                        ) : (
                          <><Copy className="h-3 w-3" />{t("copy")}</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => runAI()}
                      >
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">{t("ai_is_analyzing_your_matter")}</span>
                  </div>
                ) : (
                  <Textarea
                    value={editableResult}
                    onChange={(e) => setEditableResult(e.target.value)}
                    className="min-h-[300px] text-sm font-mono border-0 focus-visible:ring-0 resize-none p-0 bg-transparent"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MatterWorkspaceShell>
  )
}
