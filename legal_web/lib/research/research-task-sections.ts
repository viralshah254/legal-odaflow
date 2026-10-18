import type { ResearchTaskProfile } from "@/lib/api/types"

export type CanonicalResearchTaskKind =
  | "citation"
  | "section"
  | "case_analysis"
  | "case_survey"
  | "case_comparison"
  | "procedure"
  | "general"
  | "matter_opinion"
  | "legacy"

export interface ResearchSectionVisibility {
  verifiedLaw: boolean
  authoritySummary: boolean
  factApplication: boolean
  assumptions: boolean
  unresolvedFacts: boolean
  strategyGuidance: boolean
  practicalSteps: boolean
}

const visibilityByTask: Record<CanonicalResearchTaskKind, ResearchSectionVisibility> = {
  citation: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: false,
    assumptions: false,
    unresolvedFacts: false,
    strategyGuidance: false,
    practicalSteps: false,
  },
  section: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: false,
    assumptions: false,
    unresolvedFacts: false,
    strategyGuidance: false,
    practicalSteps: false,
  },
  case_analysis: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: true,
    assumptions: false,
    unresolvedFacts: true,
    strategyGuidance: false,
    practicalSteps: false,
  },
  case_survey: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: false,
    assumptions: false,
    unresolvedFacts: true,
    strategyGuidance: false,
    practicalSteps: false,
  },
  case_comparison: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: true,
    assumptions: false,
    unresolvedFacts: true,
    strategyGuidance: false,
    practicalSteps: false,
  },
  procedure: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: true,
    assumptions: true,
    unresolvedFacts: true,
    strategyGuidance: false,
    practicalSteps: true,
  },
  general: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: false,
    assumptions: false,
    unresolvedFacts: true,
    strategyGuidance: false,
    practicalSteps: false,
  },
  matter_opinion: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: true,
    assumptions: true,
    unresolvedFacts: true,
    strategyGuidance: true,
    practicalSteps: true,
  },
  // An absent task profile is an old response. Keep its existing sections visible.
  legacy: {
    verifiedLaw: true,
    authoritySummary: true,
    factApplication: true,
    assumptions: true,
    unresolvedFacts: true,
    strategyGuidance: true,
    practicalSteps: true,
  },
}

export function canonicalResearchTaskKind(
  profile?: ResearchTaskProfile,
): CanonicalResearchTaskKind {
  const raw = profile?.taskKind ?? profile?.kind ?? profile?.primary
  if (!raw) return "legacy"
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_")

  if (
    normalized === "citation" ||
    normalized === "citation_lookup" ||
    normalized === "citation_verification"
  ) {
    return "citation"
  }
  if (
    normalized === "section" ||
    normalized === "section_lookup" ||
    normalized === "statutory_interpretation"
  ) {
    return "section"
  }
  if (normalized === "case_analysis" || normalized === "case_lookup") return "case_analysis"
  if (normalized === "case_survey") return "case_survey"
  if (normalized === "case_comparison") return "case_comparison"
  if (normalized === "procedure" || normalized === "procedural_strategy") return "procedure"
  if (normalized === "matter_opinion" || normalized === "matter_aware") return "matter_opinion"
  return "general"
}

export function researchSectionVisibility(
  profile?: ResearchTaskProfile,
): ResearchSectionVisibility {
  return visibilityByTask[canonicalResearchTaskKind(profile)]
}

export function researchTaskLabel(profile?: ResearchTaskProfile): string | undefined {
  if (profile?.label?.trim()) return profile.label.trim()
  const kind = canonicalResearchTaskKind(profile)
  if (kind === "legacy") return undefined
  return {
    citation: "Citation lookup",
    section: "Section research",
    case_analysis: "Case analysis",
    case_survey: "Case survey",
    case_comparison: "Case comparison",
    procedure: "Procedure",
    general: "General research",
    matter_opinion: "Matter opinion",
  }[kind]
}
