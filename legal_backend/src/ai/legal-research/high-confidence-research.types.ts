export interface ResearchScope {
  tenantId: string;
  matterId: string;
}

export type FactStatus =
  | 'VERIFIED'
  | 'DISPUTED'
  | 'ASSUMED'
  | 'UNVERIFIED';

export type ResearchMateriality = 'DISPOSITIVE' | 'MATERIAL' | 'CONTEXT';

export type FactSourceKind =
  | 'USER'
  | 'UPLOADED_DOCUMENT'
  | 'CASE_RECORD'
  | 'MODEL_INFERENCE'
  | 'CLIENT_DOCUMENT'
  | 'WITNESS_STATEMENT'
  | 'COURT_RECORD'
  | 'PUBLIC_RECORD'
  | 'OPPOSING_PARTY'
  | 'OTHER';

export interface SourcePinpoint {
  page?: number;
  paragraph?: string;
  section?: string;
  timestamp?: string;
  quote?: string;
}

export interface FactSource {
  sourceId: string;
  kind: FactSourceKind;
  title: string;
  documentId?: string;
  uri?: string;
  obtainedAt?: string;
}

export interface FactSourceReference {
  sourceId: string;
  pinpoint: SourcePinpoint;
  supports: boolean;
  note?: string;
}

export interface FactLedgerRecord extends ResearchScope {
  factId: string;
  statement: string;
  status: FactStatus;
  disputed: boolean;
  assumed: boolean;
  materiality: ResearchMateriality;
  sources: FactSourceReference[];
  createdAt: string;
  updatedAt: string;
}

export type CurrentLawStatus =
  | 'CURRENT'
  | 'UNKNOWN'
  | 'OVERRULED'
  | 'SUPERSEDED';

export interface LegalRuleQualifiers {
  jurisdiction: string;
  court?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  asOfDate: string;
  currentLawStatus: CurrentLawStatus;
  exceptions?: string[];
  conditions?: string[];
}

export type ConfidenceDimension =
  | 'AUTHORITY_IDENTITY'
  | 'PINPOINT_SUPPORT'
  | 'PASSAGE_ENTAILMENT'
  | 'TREATMENT'
  | 'CURRENT_LAW'
  | 'FACTUAL_SUPPORT'
  | 'SOURCE_INTEGRITY'
  | 'ISSUE_COMPLETENESS'
  | 'CONCLUSION';

/**
 * Ordered confidence lattice. A proposition can be no stronger than its
 * weakest evidence dimension.
 */
export type ConfidenceLevel =
  | 'CONFLICTED'
  | 'UNKNOWN'
  | 'TENTATIVE'
  | 'CORROBORATED'
  | 'VERIFIED';

export interface ConfidenceDimensionAssessment {
  dimension: ConfidenceDimension;
  level: ConfidenceLevel;
  evidenceIds: string[];
  reason?: string;
}

export interface ConfidenceProfile {
  dimensions: ConfidenceDimensionAssessment[];
  level: ConfidenceLevel;
  ceiling?: ConfidenceLevel;
  reasons: string[];
}

export interface EvidenceConfidenceInput {
  authorityIdentity?: ConfidenceLevel;
  pinpointSupport?: ConfidenceLevel;
  passageEntailment?: ConfidenceLevel;
  treatment?: ConfidenceLevel;
  currentLaw?: ConfidenceLevel;
  factualSupport?: ConfidenceLevel;
  sourceIntegrity?: ConfidenceLevel;
  issueCompleteness?: ConfidenceLevel;
  conclusion?: ConfidenceLevel;
  evidenceIds?: Partial<Record<ConfidenceDimension, string[]>>;
  conflicts?: string[];
}

interface PropositionNodeBase extends ResearchScope {
  nodeId: string;
  statement: string;
  materiality: ResearchMateriality;
}

export interface LegalRuleNode extends PropositionNodeBase {
  kind: 'LEGAL_RULE';
  qualifiers: LegalRuleQualifiers;
  confidence: ConfidenceProfile;
}

export interface FactPropositionNode extends PropositionNodeBase {
  kind: 'FACT';
  factId: string;
}

export interface ApplicationNode extends PropositionNodeBase {
  kind: 'APPLICATION';
  confidence?: ConfidenceProfile;
}

export interface ConclusionNode extends PropositionNodeBase {
  kind: 'CONCLUSION';
  confidence?: ConfidenceProfile;
}

export type PropositionNode =
  | LegalRuleNode
  | FactPropositionNode
  | ApplicationNode
  | ConclusionNode;

export type PropositionEdgeKind =
  | 'DEPENDS_ON'
  | 'SUPPORTS'
  | 'CONFLICTS_WITH'
  | 'QUALIFIES';

export interface PropositionEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: PropositionEdgeKind;
  rationale?: string;
}

export interface PropositionGraph extends ResearchScope {
  nodes: PropositionNode[];
  edges: PropositionEdge[];
}

export type GraphValidationCode =
  | 'SCOPE_MISMATCH'
  | 'DUPLICATE_NODE'
  | 'DANGLING_EDGE'
  | 'CIRCULAR_DEPENDENCY'
  | 'APPLICATION_MISSING_LEGAL_DEPENDENCY'
  | 'APPLICATION_MISSING_FACTUAL_DEPENDENCY'
  | 'APPLICATION_UNVERIFIED_LEGAL_DEPENDENCY'
  | 'APPLICATION_UNVERIFIED_FACTUAL_DEPENDENCY'
  | 'CURRENT_LAW_UNKNOWN'
  | 'MISSING_DISPOSITIVE_FACT'
  | 'MATERIAL_CONFLICT';

export interface GraphValidationIssue {
  code: GraphValidationCode;
  nodeId?: string;
  dependencyNodeId?: string;
  message: string;
  blocking: boolean;
}

export type ResearchPublicationDecision =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'GAP'
  | 'ABSTAIN';

export interface ResearchPublicationAssessment {
  decision: ResearchPublicationDecision;
  issues: GraphValidationIssue[];
  publishableNodeIds: string[];
  reasons: string[];
}
