"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { BookMarked, Loader2, Scale, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  enrichDraftWithAuthorities,
  type DraftEnrichMode,
} from "@/lib/api/india-drafting"
import { enrichUsDraft, type UsDraftEnrichMode } from "@/lib/api/us-drafting"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { invalidateCreditWalletQueries } from "@/lib/credits/invalidate-credit-wallet"
import { useToast } from "@/hooks/use-toast"

type EnrichMode = DraftEnrichMode | UsDraftEnrichMode

interface DraftActionsToolbarProps {
  draftText: string
  documentKind: string
  rawFacts?: string
  tenantId?: string | null
  /** India v3 job id or saved draft id for enrich endpoint */
  jobId?: string | null
  /** When set, uses US enrich API instead of draft-jobs */
  countryCode?: "IN" | "US" | "KE"
  stateCode?: string
  onEnriched: (result: { enrichedDraft: string; creditsCharged: number }) => void
  disabled?: boolean
}

export function DraftActionsToolbar({
  draftText,
  documentKind,
  rawFacts = "",
  tenantId,
  jobId,
  countryCode = "IN",
  stateCode,
  onEnriched,
  disabled = false,
}: DraftActionsToolbarProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [enriching, setEnriching] = useState<EnrichMode | null>(null)

  const canEnrich = Boolean(tenantId && draftText.trim())

  const handleEnrich = async (mode: EnrichMode) => {
    if (!tenantId || !draftText.trim()) {
      toast({ title: "Cannot enrich", description: "Generate a draft first.", variant: "destructive" })
      return
    }
    setEnriching(mode)
    try {
      if (countryCode === "US") {
        const result = await enrichUsDraft(
          {
            draftText,
            documentKind,
            rawFacts,
            mode,
            stateCode,
          },
          tenantId,
        )
        onEnriched({ enrichedDraft: result.enrichedDraft, creditsCharged: result.creditsCharged })
        if (result.creditsCharged > 0) invalidateCreditWalletQueries(queryClient, tenantId)
        toast({
          title: "Draft updated",
          description: `${result.creditsCharged} credit${result.creditsCharged === 1 ? "" : "s"} · authorities added`,
        })
        return
      }

      const enrichJobId = jobId ?? `local-${Date.now()}`
      const result = await enrichDraftWithAuthorities(
        enrichJobId,
        { draftText, documentKind, rawFacts, mode },
        tenantId,
      )
      onEnriched({ enrichedDraft: result.enrichedDraft, creditsCharged: result.creditsCharged })
      if (result.creditsCharged > 0) invalidateCreditWalletQueries(queryClient, tenantId)
      toast({
        title: "Draft updated",
        description: `${result.creditsCharged} credit${result.creditsCharged === 1 ? "" : "s"} · ${
          mode === "case_laws"
            ? "case law"
            : mode === "sections"
              ? "statute sections"
              : "case law + sections"
        }`,
      })
    } catch (err) {
      toast({
        title: "Enrichment failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setEnriching(null)
    }
  }

  if (!canEnrich) return null

  const enrichCost = FEATURE_CREDIT_COSTS.RESEARCH_ENRICH

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled || enriching !== null}
          >
            {enriching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Add authorities
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={enriching !== null}
            onClick={() => void handleEnrich("case_laws")}
          >
            <BookMarked className="mr-2 h-3.5 w-3.5" />
            Case laws (~{enrichCost} credits)
          </DropdownMenuItem>
          {(countryCode === "IN" || countryCode === "KE") && (
            <>
              <DropdownMenuItem
                disabled={enriching !== null}
                onClick={() => void handleEnrich("sections")}
              >
                <Scale className="mr-2 h-3.5 w-3.5" />
                {countryCode === "KE" ? "Kenya Law sections" : "Statute sections"} (~{enrichCost}{" "}
                credits)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={enriching !== null}
                onClick={() => void handleEnrich("both")}
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Both (~{enrichCost * 2} credits)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
