"use client"
import { useTranslations } from "next-intl"

import { useState, useRef, useEffect, useCallback } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { sendCopilotMessage } from "@/lib/api/copilot"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, Sparkles, X, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const COPILOT_PROGRESS_STEPS = [
  "Reading matter context…",
  "Retrieving legal authorities…",
  "Analysing facts…",
  "Drafting response…",
]

function CopilotProgressSteps({ active }: { active: boolean }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!active) {
      setStep(0)
      return
    }
    const id = setInterval(() => {
      setStep((s) => (s < COPILOT_PROGRESS_STEPS.length - 1 ? s + 1 : s))
    }, 2400)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  return (
    <div className="py-2 space-y-1.5">
      {COPILOT_PROGRESS_STEPS.map((label, i) => (
        <div
          key={label}
          className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${
            i < step
              ? "text-muted-foreground opacity-50"
              : i === step
              ? "text-foreground font-medium"
              : "text-muted-foreground opacity-30"
          }`}
        >
          {i < step ? (
            <span className="text-primary text-xs">✓</span>
          ) : i === step ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
          ) : (
            <span className="w-3 h-3 shrink-0" />
          )}
          {label}
        </div>
      ))}
    </div>
  )
}

interface ReActStep {
  thought: string
  action: "tool" | "answer"
  toolName?: string
  toolArgs?: Record<string, unknown>
  observation?: string
  answer?: string
}

interface ReActResult {
  finalAnswer: string
  steps: ReActStep[]
  toolsUsed: string[]
}

interface MatterInlineCopilotProps {
  matterId: string
  clientId?: string
}

export function MatterInlineCopilot({ matterId, clientId }: MatterInlineCopilotProps) {
  const t = useTranslations("matters")
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [reActResult, setReActResult] = useState<ReActResult | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [deepMode, setDeepMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || !activeTenantId || loading) return
    const message = query.trim()
    setQuery("")
    setLoading(true)
    setResponse(null)
    setReActResult(null)

    try {
      if (deepMode) {
        // Use the multi-step ReAct agent
        const result = await apiFetch<ReActResult>("/ai/copilot/agent", {
          method: "POST",
          body: JSON.stringify({ query: message, matterId }),
        })
        setReActResult(result)
        setResponse(result.finalAnswer)
      } else {
        const res = await sendCopilotMessage(activeTenantId, {
          message,
          context: {
            matterId,
            clientId,
            selectedMatterId: matterId,
            selectedClientId: clientId,
          },
        })
        setResponse(res.message.content)
      }
    } catch {
      toast({ title: t("copilot_error"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [query, activeTenantId, matterId, clientId, loading, toast, deepMode])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" && e.shiftKey) || e.key === "Enter") {
      if (!e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }
  }

  // Auto-focus input when uncollapsed
  useEffect(() => {
    if (!collapsed) inputRef.current?.focus()
  }, [collapsed])

  return (
    <>
      {/* Response floating panel */}
      {(response || loading) && !collapsed && (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40">
          <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  {deepMode ? (
                    <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  )}
                  {deepMode ? t("deep_research") : t("copilot_response")}
                  {reActResult && reActResult.toolsUsed.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {reActResult.toolsUsed.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {reActResult && reActResult.steps.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowSteps(!showSteps)}
                      title={showSteps ? t("hide_reasoning") : t("show_reasoning_steps")}
                    >
                      {showSteps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  {!loading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 -mr-1"
                      onClick={() => { setResponse(null); setReActResult(null) }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Animated progress steps while loading */}
              {loading && <CopilotProgressSteps active={loading} />}

              {/* Reasoning steps (collapsible) */}
              {!loading && showSteps && reActResult && (
                <div className="mb-3 space-y-2 border-b pb-3">
                  {reActResult.steps.filter((s) => s.action === "tool").map((step, i) => (
                    <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      <div className="font-medium text-foreground/70 mb-0.5">
                        {t("reasoning_step", { step: i + 1, tool: step.toolName ?? "" })}
                      </div>
                      <div className="italic opacity-75">{step.thought}</div>
                      {step.observation && (
                        <div className="mt-1 font-mono text-[10px] opacity-60 truncate">{step.observation}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!loading && response && (
                <div className="text-sm whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                  {response}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur-sm pb-safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {collapsed ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollapsed(false)}
                className="gap-2 min-h-[44px]"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{t("ask_about_this_matter")}</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant={deepMode ? "default" : "ghost"}
                size="icon"
                className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                title={deepMode ? t("deep_research_mode_title") : t("fast_mode_title")}
                onClick={() => setDeepMode(!deepMode)}
              >
                {deepMode ? (
                  <BrainCircuit className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </Button>
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={deepMode ? t("deep_research_placeholder") : t("ask_matter_placeholder")}
                className="flex-1 min-h-[44px] sm:min-h-0"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!query.trim() || loading}
                className={cn("shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0")}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="shrink-0 sm:hidden min-h-[44px] min-w-[44px]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
