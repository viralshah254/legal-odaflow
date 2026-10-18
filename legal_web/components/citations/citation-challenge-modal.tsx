"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"
import {
  Scale,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  MessageSquare,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Citation {
  title: string
  source: string
  url?: string
  treatmentStatus?: "good_law" | "overruled" | "distinguished" | "questioned" | "superseded"
}

interface ChallengeResult {
  verdict: "confirmed" | "questioned" | "overruled"
  confidence: number
  explanation: string
  supportingAuthorities: string[]
}

interface CitationChallengeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  citation: Citation | null
  claim?: string
  tenantId?: string
}

const TREATMENT_CONFIG = {
  good_law: { label: "Good Law", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  overruled: { label: "Overruled", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  questioned: { label: "Questioned", icon: AlertTriangle, className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  distinguished: { label: "Distinguished", icon: AlertTriangle, className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  superseded: { label: "Superseded", icon: AlertTriangle, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
} as const

const VERDICT_CONFIG = {
  confirmed: { label: "Citation confirmed", icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
  questioned: { label: "Citation questioned", icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  overruled: { label: "Citation overruled", icon: XCircle, className: "text-red-600 dark:text-red-400" },
}

const CHALLENGE_PRESETS = [
  "Is this still good law?",
  "Has this been overruled or distinguished?",
  "What courts are bound by this?",
  "Show me conflicting authority",
  "What is the exact holding?",
]

/**
 * Harvey-inspired "Challenge this" demo modal.
 * Lets a lawyer dispute or interrogate a specific citation.
 * The AI responds with verdict, confidence, explanation, and supporting authorities.
 */
export function CitationChallengeModal({
  open,
  onOpenChange,
  citation,
  claim,
  tenantId,
}: CitationChallengeModalProps) {
  const [challenge, setChallenge] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChallengeResult | null>(null)

  const runChallenge = async (question?: string) => {
    if (!citation) return
    const q = (question ?? challenge).trim()
    if (!q) return

    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch<ChallengeResult>("/ai/citation-challenge", {
        method: "POST",
        tenantId,
        body: {
          citationTitle: citation.title,
          citationSource: citation.source,
          claim,
          challenge: q,
        },
      })
      setResult(res)
    } catch {
      setResult({
        verdict: "questioned",
        confidence: 0,
        explanation: "Unable to verify this citation at the moment. Please consult primary sources.",
        supportingAuthorities: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const treatment = citation?.treatmentStatus
  const treatmentConfig = treatment ? TREATMENT_CONFIG[treatment] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Challenge this citation</DialogTitle>
              <DialogDescription className="text-xs">
                Interrogate the authority, treatment, and binding weight of this source.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {citation && (
          <div className="space-y-4">
            {/* Citation card */}
            <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30">
              <div className="flex items-start gap-2">
                <Scale className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{citation.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{citation.source}</p>
                </div>
                {treatmentConfig && (
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0 shrink-0", treatmentConfig.className)}
                  >
                    <treatmentConfig.icon className="h-2.5 w-2.5 mr-0.5" />
                    {treatmentConfig.label}
                  </Badge>
                )}
              </div>
              {claim && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Claim: </span>
                    {claim}
                  </p>
                </div>
              )}
            </div>

            {/* Challenge presets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick challenges</p>
              <div className="flex flex-wrap gap-1.5">
                {CHALLENGE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setChallenge(p)
                      void runChallenge(p)
                    }}
                    disabled={loading}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom challenge */}
            <div className="space-y-2">
              <Textarea
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void runChallenge()
                  }
                }}
                placeholder="Type your challenge or question about this citation…"
                rows={2}
                className="text-sm resize-none"
              />
              <Button
                className="w-full gap-2"
                disabled={!challenge.trim() || loading}
                onClick={() => void runChallenge()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Verifying…" : "Challenge"}
              </Button>
            </div>

            {/* Result */}
            {result && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = VERDICT_CONFIG[result.verdict]
                    const Icon = config.icon
                    return (
                      <>
                        <Icon className={cn("h-4 w-4", config.className)} />
                        <span className={cn("text-sm font-semibold", config.className)}>
                          {config.label}
                        </span>
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                          {Math.round(result.confidence * 100)}% confidence
                        </Badge>
                      </>
                    )
                  })()}
                </div>
                <p className="text-sm leading-relaxed">{result.explanation}</p>
                {result.supportingAuthorities.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Supporting authorities</p>
                    {result.supportingAuthorities.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-muted-foreground text-center">
              AI-assisted citation analysis. Always verify against official sources before reliance.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
