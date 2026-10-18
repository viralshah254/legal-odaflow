/**
 * Versioned DraftPlaybook — machine-readable legal & drafting rules per document kind.
 * Models must not invent document structure; the playbook defines it.
 */

export type PlanningMode =
  | 'remedy_based'
  | 'pleading_response'
  | 'cause_of_action'
  | 'appellate_error'
  | 'contract_term'
  | 'legal_issue'
  | 'compliance_check';

export interface PlaybookField {
  id: string;
  label: string;
  path: string;
  blocking: boolean;
  description?: string;
}

export interface DraftSectionRule {
  id: string;
  title: string;
  required: boolean;
  minClaims?: number;
  prohibitedPhrases?: string[];
  requiredFactCategories?: string[];
}

export interface IssueDefinition {
  id: string;
  label: string;
  required: boolean;
  factCategories?: string[];
  authorities?: string[];
}

export interface FactCategoryRule {
  category: string;
  required: boolean;
  materialityDefault?: 'critical' | 'important' | 'background';
}

export interface StatuteRule {
  id: string;
  actId: string;
  sections?: string[];
  role: 'procedural_vehicle' | 'substantive_offence' | 'civil_cause' | 'other';
  required?: boolean;
}

export interface RemedyRule {
  id: string;
  label: string;
  allowedPrayerPatterns: string[];
  prohibitedPrayerPatterns?: string[];
}

export interface LimitationRule {
  id: string;
  description: string;
  blockingIfExpired: boolean;
}

export interface JurisdictionRule {
  id: string;
  description: string;
  supportedCourts?: string[];
}

export interface AdverseFactRule {
  id: string;
  description: string;
  dispositionDefault: 'address_adverse_fact' | 'omit_as_legally_irrelevant' | 'requires_clarification';
}

export interface PrayerRule {
  id: string;
  requiredElements: string[];
  prohibitedElements?: string[];
}

export interface VerificationRule {
  id: string;
  required: boolean;
  statementOfTruth?: boolean;
}

export type PlaybookReleaseCheckSeverity = 'blocker' | 'warning';

export interface PlaybookReleaseCheck {
  id: string;
  description: string;
  severity: PlaybookReleaseCheckSeverity;
  /** Adapter method or universal check key. */
  checkKey: string;
}

export interface DraftPlaybook {
  id: string;
  jurisdiction: string;
  documentKind: string;
  version: string;
  active: boolean;
  filingGrade: boolean;
  lawyerApproved: boolean;
  /** Explicit human-review provenance. `pending` must never be presented as advocate-reviewed. */
  advocateReview?: {
    status: 'pending' | 'reviewed';
    reviewedBy?: string;
    reviewedAt?: string;
  };
  /** Jurisdiction-specific authority details required before a draft can be treated as verified. */
  requiredAuthorityFields?: PlaybookField[];
  minEvalPassRate?: number;
  goldExampleIds?: string[];

  supportedCourts: string[];
  supportedProceduralStages: string[];

  mandatoryFields: PlaybookField[];
  optionalFields: PlaybookField[];

  requiredSections: DraftSectionRule[];
  optionalSections: DraftSectionRule[];
  prohibitedSections?: DraftSectionRule[];

  issueTaxonomy: IssueDefinition[];
  requiredFactCategories: FactCategoryRule[];
  planningMode: PlanningMode;

  statuteRules: StatuteRule[];
  remedyRules: RemedyRule[];
  limitationRules?: LimitationRule[];
  jurisdictionRules?: JurisdictionRule[];

  adverseFactRules: AdverseFactRule[];
  prayerRules: PrayerRule[];
  verificationRules: VerificationRule[];

  releaseChecks: PlaybookReleaseCheck[];

  /** Legacy compatibility with DraftKindPlaybook. */
  partyLabel?: string;
  minCitationsPerGround?: number;
  minVerifiedCaseAuthorities?: number;
  factCoverageThreshold?: number;
}
