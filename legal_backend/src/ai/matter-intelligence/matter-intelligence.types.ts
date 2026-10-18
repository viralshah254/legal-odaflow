/** Canonical matter classification — single source of truth for all platform surfaces. */

export type MatterNature = 'dispute' | 'transaction' | 'compliance' | 'advisory' | 'unknown';

export type MatterStage =
  | 'pre_filing'
  | 'filing'
  | 'post_order'
  | 'appeal'
  | 'compliance';

export type MatterPosture =
  | 'original'
  | 'revision'
  | 'appeal'
  | 'execution'
  | 'review';

export interface MatterFieldConfidence {
  practiceArea: number;
  subPracticeArea: number;
  nature: number;
  forum: number;
}

export interface MatterProfile {
  country: string;
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  forum?: string;
  stage?: MatterStage;
  posture?: MatterPosture;
  remedies: string[];
  issues: string[];
  documentTypes: string[];
  documentKind?: string;
  curatedKinds: string[];
  confidence: number;
  fieldConfidence?: MatterFieldConfidence;
  jurisdiction?: string;
}

export interface MatterParty {
  name: string;
  role?: string;
  side?: 'claimant' | 'respondent' | 'applicant' | 'other';
}

export interface MatterClaim {
  summary: string;
  reliefSought?: string;
}

export interface MatterDefence {
  summary: string;
}

export interface StatuteRef {
  act: string;
  section?: string;
}

export interface PrecedentRef {
  citation: string;
  title?: string;
}

export interface EvidenceAnalysisFlags {
  admission?: boolean;
  contradiction?: boolean;
  paymentProof?: boolean;
  threat?: boolean;
}

export interface EvidenceRef {
  id?: string;
  description: string;
  sourceType?: string;
  sourceDocumentId?: string;
  date?: string;
  party?: string;
  docType?: string;
  flags?: EvidenceAnalysisFlags;
}

export interface MatterDocumentRef {
  id?: string;
  title: string;
  documentType?: string;
}

export interface TimelineEvent {
  date?: string;
  description: string;
  eventType?: string;
}

export interface MatterGraph {
  matterId?: string;
  parties: MatterParty[];
  claims: MatterClaim[];
  defences: MatterDefence[];
  statutes: StatuteRef[];
  precedents: PrecedentRef[];
  evidence: EvidenceRef[];
  documents: MatterDocumentRef[];
  timeline: TimelineEvent[];
}

export interface MatterDeadline {
  label: string;
  dueDate?: string;
  description?: string;
}

export interface MatterTaskGraph {
  recommendedActions: string[];
  requiredDocuments: string[];
  missingDocuments: string[];
  deadlines: MatterDeadline[];
  nextBestAction?: string;
}

export interface LegalAssetMetadata {
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  forum?: string;
  documentType?: string;
  stage?: string;
  jurisdiction?: string;
  confidence?: number;
  curatedKind?: string;
}

export interface ClarifyingQuestion {
  id: string;
  text: string;
  options?: string[];
  field: keyof MatterProfile | 'nature' | 'forum';
}

export interface MatterClassificationResult {
  profile: MatterProfile;
  graph?: MatterGraph;
  taskGraph?: MatterTaskGraph;
  clarifyingQuestions: ClarifyingQuestion[];
  shouldProceed: boolean;
  recommendationMode: 'matched' | 'low_confidence' | 'clarification_required';
}

export interface MatterIntelligenceInput {
  facts: string;
  countryCode?: string;
  jurisdiction?: string;
  locale?: string;
  existingProfile?: MatterProfile;
  tenantId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
}

export interface MatterIntelligenceEvent {
  eventType:
    | 'document_selected'
    | 'document_generated'
    | 'document_filed'
    | 'document_downloaded'
    | 'action_completed';
  matterProfileHash: string;
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  documentId?: string;
  documentKind?: string;
  tenantId?: string;
  userId?: string;
  createdAt?: string;
}
