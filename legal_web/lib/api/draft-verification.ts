import type { SectionChecksAudit, SimilarCase } from "@/lib/api/types"
import type {
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from "@/lib/api/verification"

export type DraftVerificationStatus = "verified" | "needs_review" | "limited_sources"

export interface StrippedCitation {
  original: string
  reason: string
}

export interface DraftCitationAudit {
  verified: number
  total: number
  unverifiable: string[]
}

export interface DraftVerificationAudit {
  corrections: Array<{ from: string; to: string; reason: string; source: string }>
  similarCases: SimilarCase[]
  sectionChecks: SectionChecksAudit
  citationWarnings: string[]
  strippedCitations: StrippedCitation[]
  citationAudit?: DraftCitationAudit
  sentenceAudit?: { coverageRate: number; ungroundedCount: number }
  proceduralWarnings: string[]
  completenessGaps: string[]
  requiresLawyerReview: boolean
  verificationStatus: DraftVerificationStatus
  canCertify?: boolean
  certificationLabel?:
    | "lawyer_ready"
    | "verified_for_filing"
    | "complete_missing_facts"
    | "needs_review"
  unresolvedFacts?: string[]
  lawyerReady?: boolean
  factCoverageRate?: number
  missingDefenceFacts?: string[]
  autoAppliedFixes?: Array<{ originalText: string; suggestedText: string; reason: string }>
  findings?: VerificationFinding[]
  propositions?: VerifiedPropositionSummary[]
  evidencePackId?: string
  outputHash?: string
  dimensions?: VerificationDimensions
  publicationState?: PublicationState
}
