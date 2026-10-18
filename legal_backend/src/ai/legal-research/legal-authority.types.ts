export type LegalAuthorityType =
  | 'STATUTE'
  | 'CASE'
  | 'RULE'
  | 'REGULATION'
  | 'SECONDARY';

export type BindingStatus = 'BINDING' | 'PERSUASIVE' | 'UNKNOWN';

export type CurrentLawStatus =
  | 'GOOD_LAW'
  | 'OVERRULED'
  | 'REVERSED'
  | 'DOUBTED'
  | 'DISTINGUISHED'
  | 'SUPERSEDED'
  | 'UNKNOWN';

export type SourceQuality =
  | 'OFFICIAL_PRIMARY'
  | 'MIXED_PRIMARY_SECONDARY'
  | 'SECONDARY_ONLY'
  | 'INSUFFICIENT';

export type LegalAuthority = {
  id: string;
  jurisdiction: string;
  subJurisdiction?: string;
  authorityType: LegalAuthorityType;
  sourceName: string;
  sourceUrl?: string;
  /** Canonical document URL returned by the source/corpus. */
  canonicalUrl?: string;
  /** Exact provision or judgment-paragraph URL; never synthesized by the UI. */
  deepLinkUrl?: string;
  official: boolean;
  title: string;
  citation?: string;
  neutralCitation?: string;
  court?: string;
  bench?: string;
  judgeNames?: string[];
  date?: string;
  decisionDate?: string;
  provisions?: string[];
  extractedText: string;
  summary?: string;
  practiceAreas?: string[];
  topics?: string[];
  pinpoint?: string;
  quotedPassage?: string;
  quotedPassageVerified?: boolean;
  actName?: string;
  actYear?: number;
  section?: string;
  heading?: string;
  regulator?: string;
  instrumentType?: string;
  instrumentNumber?: string;
  instrumentDate?: string;
  reliabilityRank: 1 | 2 | 3 | 4 | 5;
  bindingStatus?: BindingStatus;
  currentLawStatus?: CurrentLawStatus;
  isRepealed?: boolean;
  /** Prospective material (for example a bill) cannot establish current law. */
  prospectiveOnly?: boolean;
  sourceClass?: 'OFFICIAL_PRIMARY' | 'OFFICIAL_PROSPECTIVE' | 'OFFICIAL_ADMINISTRATIVE' | 'SECONDARY';
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type LegalClaim = {
  claim: string;
  requiredAuthorityType: 'STATUTE' | 'CASE' | 'ANY';
  citations: string[];
  supported: boolean;
  supportExcerpt?: string;
  confidence: 'high' | 'medium' | 'low';
  issue?: string;
};

export type CitationAuditResult = {
  verifiedMarkdown: string;
  claims: LegalClaim[];
  unsupportedClaims: LegalClaim[];
  citationCount: number;
  verifiedCitationCount: number;
  warnings: string[];
  /** Spec fields (Stage 6 audit). Optional for backward compatibility. */
  totalClaims?: number;
  supportedClaims?: number;
  totalCitations?: number;
  verifiedCitations?: number;
  unverifiedCitations?: string[];
  sourceQuality?: SourceQuality;
  /** Identity matches, kept separate from full seven-dimension verification. */
  foundCitationCount?: number;
  /** Only citations that passed the integrity contract and all core dimensions. */
  citations?: CitationAuditEntry[];
  rejectedCitations?: CitationAuditEntry[];
  verificationGaps?: Array<{ citation: string; reasons: string[] }>;
  safeForReliance?: boolean;
  /** Kenya-specific fail-closed status used by publication and the UI. */
  kenyaVerified?: boolean;
  verificationDowngradeReasons?: string[];
};

export type CitationCheckState = 'PASS' | 'FAIL' | 'INDETERMINATE';

export interface CitationAuditEntry {
  citation: string;
  authorityId?: string;
  found: boolean;
  verified: boolean;
  url?: string;
  deepLinkUrl?: string;
  pinpoint?: string;
  checks: Array<{
    dimension:
      | 'identity'
      | 'relevance'
      | 'passage'
      | 'pinpoint'
      | 'jurisdiction'
      | 'currentLaw'
      | 'hierarchy'
      | 'contract';
    state: CitationCheckState;
    reason: string;
  }>;
  missingReasons: string[];
}
