export type ResearchTaskKind =
  | 'SECTION_LOOKUP'
  | 'STATUTORY_INTERPRETATION'
  | 'CASE_LOOKUP'
  | 'CASE_SURVEY'
  | 'CASE_ANALYSIS'
  | 'CASE_COMPARISON'
  | 'CITATION_VERIFICATION'
  | 'CURRENT_LAW'
  | 'ADVERSE_AUTHORITY'
  | 'PROCEDURE'
  | 'GENERAL_RESEARCH'
  | 'MATTER_OPINION';

export interface NormalizeResearchRequestInput {
  query: string;
  facts?: string;
  countryCode?: string;
  jurisdiction?: string;
  practiceArea?: string;
  proceduralPosture?: string;
  courtLevel?: string;
  asOfDate?: string;
  eventDate?: string;
  desiredOutput?: 'ANSWER' | 'AUTHORITY_LIST' | 'ANALYSIS' | 'MEMO' | 'VERIFICATION';
  requestedTaskKind?: ResearchTaskKind;
  requestedSources?: string[];
}

export interface NormalizedResearchRequest {
  objective: string;
  facts?: string;
  countryCode?: string;
  jurisdiction?: string;
  practiceArea?: string;
  proceduralPosture?: string;
  courtLevel?: string;
  asOfDate: string;
  eventDate?: string;
  desiredOutput: 'ANSWER' | 'AUTHORITY_LIST' | 'ANALYSIS' | 'MEMO' | 'VERIFICATION';
  requestedTaskKind?: ResearchTaskKind;
  requestedSources: string[];
  citedAuthorities: string[];
  statuteReferences: string[];
  raw: Readonly<NormalizeResearchRequestInput>;
}

export type ResearchCapability = 'CASE_LAW' | 'STATUTES' | 'CURRENT_LAW' | 'LIVE_WEB' | 'TREATMENT';

export type ResearchArchetype =
  | 'STATUTE_TEXT'
  | 'STATUTE_MEANING'
  | 'DOCTRINE'
  | 'PROCEDURE'
  | 'CASE_SURVEY'
  | 'CASE_COMPARE'
  | 'CASE_ANALYZE'
  | 'CITATION'
  | 'CURRENT_LAW'
  | 'MATTER_OPINION'
  | 'GENERAL';

export interface ResearchAnswerShape {
  includeShortAnswer: boolean;
  includeLegalFramework: boolean;
  includeApplication: boolean;
  includeRisks: boolean;
  includePracticalSteps: boolean;
  includeCaseSurveyLayers: boolean;
  desiredOutput: NormalizedResearchRequest['desiredOutput'];
}

export interface ResearchEvidenceBundleRecipe {
  requiredCapabilities: ResearchCapability[];
  optionalCapabilities: ResearchCapability[];
  sourceClasses: Array<'STATUTES' | 'CASE_LAW' | 'TREATMENT' | 'WEB'>;
  minCases: number;
  targetCases: number;
  targetSections: number;
  requireTreatment: boolean;
  requireContraryCheck: boolean;
  requireSimilarCases: boolean;
}

export interface ResearchPublicationPolicy {
  requiredDimensions: Array<
    | 'AUTHORITY_IDENTITY'
    | 'PINPOINT_SUPPORT'
    | 'PASSAGE_ENTAILMENT'
    | 'TREATMENT'
    | 'CURRENT_LAW'
    | 'SOURCE_INTEGRITY'
    | 'ISSUE_COMPLETENESS'
    | 'CONCLUSION'
    | 'FACTUAL_SUPPORT'
  >;
  allowPartialPublication: boolean;
  allowResearchLeads: boolean;
  hardAbortOnMissingCases: boolean;
}

export type ResearchKnowledgeSource =
  | 'statutes'
  | 'case_law'
  | 'regulations'
  | 'firm_vault'
  | 'web';

export interface ResearchSourcePlan {
  mode: 'AUTO' | 'CUSTOM';
  effectiveSources: ResearchKnowledgeSource[];
  discoverySources: ResearchKnowledgeSource[];
  reasons: string[];
}

export interface ResearchSourceCapability {
  id: string;
  kind: 'connector' | 'corpus';
  jurisdiction: string;
  capabilities: ResearchCapability[];
  available: boolean;
  reason?: string;
  edition?: string;
  lastVerified?: string;
}

export interface ResearchCapabilitySnapshot {
  generatedAt: string;
  jurisdiction: string;
  sources: ResearchSourceCapability[];
  availableCapabilities: ResearchCapability[];
  unavailableCapabilities: ResearchCapability[];
  failClosed: boolean;
  confidenceCeiling: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  coveredJurisdictions: string[];
  courtCoverage: Array<{ court: string; fromDate?: string; toDate?: string; complete: boolean }>;
  statuteEditions: Array<{ corpusId: string; edition: string; asOfDate?: string }>;
  treatmentGraphAvailable: boolean;
  pinpointSupport: boolean;
  officialSourceAccess: boolean;
  fullTextSupport: boolean;
  ocrSupport: boolean;
  languageSupport: string[];
  connectorAvailability: Record<string, boolean>;
  limitations: string[];
}

export interface ResearchTaskProfile {
  kind: ResearchTaskKind;
  archetype?: ResearchArchetype;
  answerShape?: ResearchAnswerShape;
  evidenceBundle?: ResearchEvidenceBundleRecipe;
  publicationPolicy?: ResearchPublicationPolicy;
  sourcePlan?: ResearchSourcePlan;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  scores: Record<ResearchTaskKind, number>;
  reasons: string[];
  tied: boolean;
  fallbackUsed: boolean;
  requiredCapabilities: ResearchCapability[];
  clarification?: {
    question: string;
    reason: string;
    missingFields: string[];
  };
}

export type ResearchIssueMateriality = 'DISPOSITIVE' | 'MATERIAL' | 'BACKGROUND';
export type ResearchIssueStatus =
  | 'PLANNED'
  | 'SUPPORTED'
  | 'CONFLICTED'
  | 'GAP'
  | 'NOT_APPLICABLE'
  | 'IDENTITY_UNRESOLVED'
  | 'SOURCE_UNAVAILABLE'
  | 'QUERY_EXHAUSTED'
  | 'NO_AUTHORITY_FOUND';
export type ResearchPropositionType =
  | 'LEGAL_RULE'
  | 'CASE_HOLDING'
  | 'STATUTORY_TEXT'
  | 'PROCEDURAL_REQUIREMENT'
  | 'APPLICATION'
  | 'CONCLUSION';

export interface ResearchIssue {
  id: string;
  question: string;
  proposition: string;
  propositionType: ResearchPropositionType;
  dependencies: string[];
  dependsOn: string[];
  materiality: ResearchIssueMateriality;
  status: ResearchIssueStatus;
  provesWith: string[];
  disprovesWith: string[];
  minimumAuthority: string;
  temporalCutoff: string;
  jurisdiction: string;
  forum?: string;
  permittedSourceClasses: Array<'PRIMARY' | 'REPORTED' | 'OFFICIAL' | 'SECONDARY_DISCOVERY'>;
  expectedOutput: string;
  contraryPositionRequired: boolean;
  requiredCapabilities: ResearchCapability[];
}

export type QueryFamily =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'CONTRARY_AUTHORITY'
  | 'TREATMENT'
  | 'CURRENT_LAW'
  | 'STATUTORY_TEXT'
  | 'PROCEDURE'
  | 'CITATION'
  | 'EXACT_CITATION'
  | 'PARTY_NAME'
  | 'STATUTE_SECTION'
  | 'PROPOSITION'
  | 'DOCTRINAL_SYNONYM'
  | 'NEGATIVE_FORMULATION'
  | 'COURT_SPECIFIC'
  | 'LATER_TREATMENT'
  | 'CITED_BY'
  | 'CITING'
  | 'LOCAL_LANGUAGE';

export interface PlannedQuery {
  id: string;
  issueId: string;
  family: QueryFamily;
  query: string;
  purpose: string;
  priority: number;
  maxResults: number;
  requiredCapabilities: ResearchCapability[];
}

export interface ResearchStoppingCondition {
  id: string;
  description: string;
  metric:
    | 'PRIMARY_AUTHORITIES_PER_ISSUE'
    | 'BINDING_AUTHORITIES_PER_ISSUE'
    | 'QUERY_FAMILY_EXHAUSTED'
    | 'CONTRARY_CHECK_COMPLETE'
    | 'CURRENT_LAW_CHECK_COMPLETE'
    | 'CITATION_RESOLVED'
    | 'CAPABILITY_UNAVAILABLE';
  threshold?: number;
  hard: boolean;
  appliesToIssueIds: string[];
}

export interface ResearchConflictCheck {
  id: string;
  issueId: string;
  compareBy: Array<'HOLDING' | 'COURT' | 'DATE' | 'JURISDICTION' | 'STATUTORY_VERSION'>;
  required: boolean;
}

export interface ResearchContraryCheck {
  id: string;
  issueId: string;
  queryIds: string[];
  required: boolean;
  complete: boolean;
}

export interface ExecutableResearchPlan {
  version: 1;
  request: NormalizedResearchRequest;
  task: ResearchTaskProfile;
  capabilities: ResearchCapabilitySnapshot;
  issues: ResearchIssue[];
  queries: PlannedQuery[];
  stoppingConditions: ResearchStoppingCondition[];
  conflictChecks: ResearchConflictCheck[];
  contraryChecks: ResearchContraryCheck[];
  executable: boolean;
  blockers: string[];
}
