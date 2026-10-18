export type DraftIntentMatchType =
  | 'official_form'
  | 'curated_draft'
  | 'template'
  | 'generate'
  | 'import_edit';

export interface DraftIntentOfficialFormMatch {
  type: 'official_form';
  confidence: number;
  summary: string;
  formId: string;
  formName: string;
  formNumber: string | null;
  countryCode: string;
  authority: string;
  draftUrl: string;
  /** Fact-grounded reason explaining why this form is relevant to the given case. */
  reason?: string;
}

export interface DraftIntentCuratedDraftMatch {
  type: 'curated_draft';
  confidence: number;
  summary: string;
  kind: string;
  label: string;
  countryCode: string;
  draftUrl: string;
  /** Short procedural note shown to the user when legal routing differs from their stated intent. */
  proceduralNote?: string;
  /** Fact-grounded reason explaining why this document is relevant to the given case. */
  reason?: string;
  /** Part of a recommended multi-document filing set. */
  bundleRecommended?: boolean;
  bundleOrder?: number;
  /** Suggestions ranked from facts while clarifying answers remain uncertain. */
  provisional?: boolean;
  /** Primary recommended set vs opposing-party documents. */
  bundleRole?: 'primary' | 'opposing_party';
  advocateReviewStatus?: 'pending' | 'reviewed';
  requiredAuthorityFields?: string[];
}

export interface DraftIntentTemplateMatch {
  type: 'template';
  confidence: number;
  summary: string;
  templateId: string;
  name: string;
  source: 'system' | 'firm' | 'user';
  documentKind: string | null;
  countryCode: string | null;
  editUrl: string;
  useUrl: string;
}

export interface DraftIntentGenerateMatch {
  type: 'generate';
  confidence: number;
  summary: string;
  suggestedKind: string;
  countryCode: string;
  documentKind?: string;
  reason: string;
  draftUrl: string;
}

export interface DraftIntentImportEditMatch {
  type: 'import_edit';
  confidence: number;
  summary: string;
  documentKind: string;
  draftUrl: string;
}

export type DraftIntentMatch =
  | DraftIntentOfficialFormMatch
  | DraftIntentCuratedDraftMatch
  | DraftIntentTemplateMatch
  | DraftIntentGenerateMatch
  | DraftIntentImportEditMatch;

export interface DraftIntentClassification {
  intent: 'filing' | 'contract' | 'letter' | 'unknown';
  documentKind?: string;
  countryCode?: string;
  jurisdiction?: string;
}

export interface DraftRouteDecision {
  jurisdiction: string;
  practiceArea: string;
  subPracticeArea: string;
  partyRole: 'claimant' | 'respondent' | 'petitioner' | 'accused' | 'unknown';
  causeOfAction: string;
  claimBasis: string;
  proceedingType: string;
  documentKind: string;
  draftKind: string;
  forum: string;
  courtLevel: string;
  territorialBasis: string[];
  mandatoryPreFilingSteps: string[];
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  blockingIssues: Array<{
    id: string;
    field: string;
    message: string;
  }>;
  primaryDocumentLabel: string;
  supportingDocumentLabels: string[];
  calculation?: import('./commercial-recovery-calculator').CommercialRecoveryCalculation;
}

export interface DraftIntentResolveResult {
  query: string;
  classification: DraftIntentClassification;
  matches: DraftIntentMatch[];
  creditsUsed: number;
  balanceRemaining: number;
  matterProfile?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterProfile;
  matterGraph?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterGraph;
  taskGraph?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterTaskGraph;
  recommendedActions?: string[];
  issues?: string[];
  clarifyingQuestions?: import('@/ai/matter-intelligence/matter-intelligence.types').ClarifyingQuestion[];
  recommendationMode?: 'matched' | 'low_confidence' | 'clarification_required';
  nextBestAction?: string;
  outcomeHint?: string;
  documentBundle?: import('./draft-intent-bundles').DraftIntentBundleItem[];
  /** Whether the filing set came from an explicit user document list or a playbook. */
  bundleSource?: 'explicit' | 'playbook';
  /** True when user skipped clarifying questions and received provisional suggestions. */
  clarificationSkipped?: boolean;
  /** Deterministic playbook id when facts matched a known intake pattern. */
  playbookId?: string;
  /** True when suggestions are fact-ranked while answers remain uncertain. */
  provisionalSuggestions?: boolean;
  routeDecision?: DraftRouteDecision;
  draftingBlocked?: boolean;
  explicitDocumentResolutions?: import('./explicit-document-resolver.types').ExplicitDocumentResolution[];
  unmappedExplicitPhrases?: import('./explicit-document-resolver.types').UnmappedExplicitPhrase[];
}

// ─── Pre-analysis types (free, no credits) ───────────────────────────────────

export interface ClarifyingQuestionOption {
  value: string;
  label: string;
  hint?: string;
  routes_to?: string;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  options: ClarifyingQuestionOption[];
  /** When true, the user may select more than one option (rendered as checkboxes). */
  multiSelect?: boolean;
}

export interface DraftContext {
  jurisdiction?: string;
  statute?: string;
  court?: string;
  orderType?: string;
  documentIntent?: string;
  statuteConfidence?: 'high' | 'medium' | 'low' | 'none';
  documentKind?: string;
  documentKindConfidence?: 'high' | 'medium' | 'low';
  documentKindAlternatives?: string[];
  documentKindReason?: string;
}

import type { ExtractedMatterFacts } from './matter-fact-extractor';

export interface DraftAnalyzeResult {
  context: DraftContext;
  questions: ClarifyingQuestion[];
  extractedFacts?: ExtractedMatterFacts;
  matterProfile?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterProfile;
  matterGraph?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterGraph;
  taskGraph?: import('@/ai/matter-intelligence/matter-intelligence.types').MatterTaskGraph;
  recommendedActions?: string[];
  issues?: string[];
  recommendationMode?: 'matched' | 'low_confidence' | 'clarification_required';
  nextBestAction?: string;
  outcomeHint?: string;
  routeDecision?: DraftRouteDecision;
  draftingBlocked?: boolean;
}
