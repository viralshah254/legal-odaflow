import type { IntakeProgressStage } from "@/components/issue-checker/intake-analysis-progress"
import { getCountryName } from "@/lib/geo/detect-country"
import {
  buildCaseAnalysisLabels,
  buildJudgmentReviewLabels,
} from "@/lib/leads/analysis-progress-exemplars"
import {
  Calendar,
  FileSearch,
  FileText,
  Gavel,
  Lightbulb,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Target,
} from "lucide-react"

export type DeepAnalysisKind = "similarCases" | "opponentAngles" | "strategyMemo"

export interface DeepAnalysisProgressContext {
  countryCode: string
  jurisdiction?: string | null
  hasDocuments?: boolean
}

function jurisdictionPhrase(ctx: DeepAnalysisProgressContext): string {
  const countryName = getCountryName(ctx.countryCode)
  if (ctx.jurisdiction?.trim()) {
    return ctx.jurisdiction.trim()
  }
  return countryName
}

function countryName(ctx: DeepAnalysisProgressContext): string {
  return getCountryName(ctx.countryCode)
}

function buildSimilarCasesStages(ctx: DeepAnalysisProgressContext): IntakeProgressStage[] {
  const jurisdiction = jurisdictionPhrase(ctx)
  const country = countryName(ctx)
  const stages: IntakeProgressStage[] = [
    {
      id: "facts",
      label: "Reviewing matter facts and intake summary",
      icon: FileSearch,
      durationMs: 2800,
    },
  ]

  if (ctx.hasDocuments) {
    stages.push({
      id: "documents",
      label: "Reviewing uploaded pleadings and evidence",
      icon: FileText,
      durationMs: 3200,
    })
  }

  stages.push(
    {
      id: "summarize",
      label: "Summarising case posture and legal issues",
      icon: Lightbulb,
      durationMs: 3000,
    },
    {
      id: "search",
      label: `Searching precedents in ${country}`,
      icon: Scale,
      durationMs: 3500,
    },
    {
      id: "review-judgments",
      label: `Reviewing binding judgments from ${jurisdiction}`,
      icon: Gavel,
      durationMs: 4000,
      rotatingLabels: buildJudgmentReviewLabels(ctx.countryCode),
    },
    {
      id: "compare",
      label: "Comparing binding vs persuasive authority",
      icon: Scale,
      durationMs: 3200,
      rotatingLabels: buildCaseAnalysisLabels(ctx.countryCode),
    },
    {
      id: "draft",
      label: "Drafting case law matrix and recommendations",
      icon: Sparkles,
      durationMs: 0,
    },
  )

  return stages
}

function buildOpponentStages(ctx: DeepAnalysisProgressContext): IntakeProgressStage[] {
  const jurisdiction = jurisdictionPhrase(ctx)
  const stages: IntakeProgressStage[] = [
    {
      id: "facts",
      label: "Reviewing factual matrix and party positions",
      icon: FileSearch,
      durationMs: 2800,
    },
  ]

  if (ctx.hasDocuments) {
    stages.push({
      id: "documents",
      label: "Reviewing pleadings and correspondence",
      icon: FileText,
      durationMs: 3000,
    })
  }

  stages.push(
    {
      id: "claims",
      label: "Mapping opposing party claims and causes of action",
      icon: Swords,
      durationMs: 3200,
    },
    {
      id: "defences",
      label: `Anticipating defences under ${jurisdiction} law`,
      icon: Shield,
      durationMs: 3500,
    },
    {
      id: "weaknesses",
      label: "Stress-testing evidence gaps and weaknesses",
      icon: Target,
      durationMs: 3200,
      rotatingLabels: [
        "Reviewing opposing counsel's likely arguments",
        "Identifying vulnerabilities in their evidence chain",
        "Evaluating procedural objections they may raise",
        "Assessing credibility challenges to key witnesses",
      ],
    },
    {
      id: "counters",
      label: "Building counter-argument matrix",
      icon: Lightbulb,
      durationMs: 3000,
    },
    {
      id: "draft",
      label: "Drafting opponent analysis and rebuttal points",
      icon: Sparkles,
      durationMs: 0,
    },
  )

  return stages
}

function buildStrategyStages(ctx: DeepAnalysisProgressContext): IntakeProgressStage[] {
  const jurisdiction = jurisdictionPhrase(ctx)
  const stages: IntakeProgressStage[] = [
    {
      id: "chronology",
      label: "Reviewing matter chronology and procedural history",
      icon: FileSearch,
      durationMs: 2800,
    },
  ]

  if (ctx.hasDocuments) {
    stages.push({
      id: "documents",
      label: "Extracting key facts from uploaded documents",
      icon: FileText,
      durationMs: 3000,
    })
  }

  stages.push(
    {
      id: "posture",
      label: `Evaluating procedural posture in ${jurisdiction}`,
      icon: Scale,
      durationMs: 3200,
    },
    {
      id: "pathways",
      label: "Modelling settlement vs trial pathways",
      icon: Lightbulb,
      durationMs: 3500,
      rotatingLabels: [
        "Assessing early settlement leverage",
        "Evaluating trial readiness and cost exposure",
        "Reviewing ADR and mediation options",
        "Comparing risk-adjusted outcomes by pathway",
      ],
    },
    {
      id: "deadlines",
      label: "Identifying limitation periods and hearing deadlines",
      icon: Calendar,
      durationMs: 3000,
    },
    {
      id: "evidence",
      label: "Prioritising evidence, witnesses, and disclosure",
      icon: Target,
      durationMs: 3200,
    },
    {
      id: "draft",
      label: "Drafting strategic memo with recommended path",
      icon: Sparkles,
      durationMs: 0,
    },
  )

  return stages
}

export function buildDeepAnalysisStages(
  kind: DeepAnalysisKind,
  ctx: DeepAnalysisProgressContext,
): IntakeProgressStage[] {
  switch (kind) {
    case "similarCases":
      return buildSimilarCasesStages(ctx)
    case "opponentAngles":
      return buildOpponentStages(ctx)
    case "strategyMemo":
      return buildStrategyStages(ctx)
  }
}

export function getDeepAnalysisProgressTitle(
  kind: DeepAnalysisKind,
  ctx: DeepAnalysisProgressContext,
): string {
  const country = countryName(ctx)
  switch (kind) {
    case "similarCases":
      return `Searching similar cases in ${country}`
    case "opponentAngles":
      return "Mapping opponent arguments"
    case "strategyMemo":
      return `Building strategy options for ${country}`
  }
}
