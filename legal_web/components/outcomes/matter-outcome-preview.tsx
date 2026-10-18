"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api/client"
import {
  TrendingUp,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface OutcomePreviewData {
  winProbability: number
  settlementProbability: number
  riskLevel: "Low" | "Medium" | "High" | "Critical"
  headline: string
  recommendedStrategy: string
  keyRisks: string[]
  requiresApproval: boolean
}

interface MatterOutcomePreviewProps {
  matterId: string
  tenantId?: string
  className?: string
}

const RISK_CONFIG = {
  Low: { label: "Low risk", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  Medium: { label: "Medium risk", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  High: { label: "High risk", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  Critical: { label: "Critical risk", className: "bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-200" },
}

/**
 * Compact outcome preview card for the matter overview page.
 * Shows a quick AI-generated probability summary with a link to full analysis.
 * Requires lawyer approval before surfacing to clients.
 */
export function MatterOutcomePreview({
  matterId,
  tenantId,
  className,
}: MatterOutcomePreviewProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<OutcomePreviewData | null>(null)
  const [noData, setNoData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    setNoData(false)
    try {
      const res = await apiFetch<OutcomePreviewData | null>(
        `/matters/${matterId}/outcome-analysis/preview`,
        { tenantId },
      )
      if (res === null) {
        setNoData(true)
      } else {
        setPreview(res)
      }
    } catch {
      setError("Could not load outcome preview. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const riskConfig = preview ? RISK_CONFIG[preview.riskLevel] : null

  if (!preview) {
    return (
      <div className={cn("rounded-xl border p-4 space-y-3 bg-card", className)}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Outcome preview</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 ml-auto">
            <Lock className="h-2.5 w-2.5" />
            Requires approval
          </Badge>
        </div>
        {noData ? (
          <p className="text-xs text-muted-foreground">
            No outcome analysis has been run for this matter yet. Add facts, issues, and documents then generate a full analysis first.
          </p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Get a quick AI-generated outcome probability based on matter facts and precedents.
            Requires lawyer approval before sharing with clients.
          </p>
        )}
        {!noData && (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 text-xs"
            onClick={() => void runPreview()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            {loading ? "Loading preview…" : "Load outcome preview"}
          </Button>
        )}
        {noData && (
          <Button size="sm" variant="outline" className="w-full gap-2 text-xs" asChild>
            <Link href={`/app/matters/${matterId}/outcome`}>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Generate full analysis
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3 bg-card", className)}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Outcome preview</p>
        {riskConfig && (
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 ml-auto", riskConfig.className)}>
            {riskConfig.label}
          </Badge>
        )}
      </div>

      {/* Probabilities */}
      {(preview.winProbability > 0 || preview.settlementProbability > 0) && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">Win probability</span>
              <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                {Math.round(preview.winProbability * 100)}%
              </span>
            </div>
            <Progress value={preview.winProbability * 100} className="h-1.5" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">Settlement probability</span>
              <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                {Math.round(preview.settlementProbability * 100)}%
              </span>
            </div>
            <Progress value={preview.settlementProbability * 100} className="h-1.5" />
          </div>
        </div>
      )}

      {/* Headline */}
      <p className="text-xs text-muted-foreground leading-relaxed">{preview.headline}</p>

      {/* Recommended strategy */}
      {preview.recommendedStrategy && (
        <div className="flex items-start gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs">{preview.recommendedStrategy}</p>
        </div>
      )}

      {/* Key risks */}
      {preview.keyRisks.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key risks</p>
          {preview.keyRisks.slice(0, 3).map((risk, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {risk}
            </div>
          ))}
        </div>
      )}

      {/* Approval gate notice + full analysis link */}
      {preview.requiresApproval && (
        <div className="border-t pt-2 flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground flex-1">
            Requires partner approval before sharing with client.
          </p>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" asChild>
            <Link href={`/app/matters/${matterId}/outcome`}>
              Full analysis
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
