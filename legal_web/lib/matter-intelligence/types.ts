/** Canonical matter classification — mirrors legal_backend matter-intelligence.types.ts */

export type MatterNature = "dispute" | "transaction" | "compliance" | "advisory" | "unknown"

export type MatterStage =
  | "pre_filing"
  | "filing"
  | "post_order"
  | "appeal"
  | "compliance"

export type MatterPosture =
  | "original"
  | "revision"
  | "appeal"
  | "execution"
  | "review"

export interface MatterFieldConfidence {
  practiceArea: number
  subPracticeArea: number
  nature: number
  forum: number
}

export interface MatterProfile {
  country: string
  practiceArea: string
  subPracticeArea?: string
  nature: MatterNature
  forum?: string
  stage?: MatterStage
  posture?: MatterPosture
  remedies: string[]
  issues: string[]
  documentTypes: string[]
  documentKind?: string
  curatedKinds: string[]
  confidence: number
  fieldConfidence?: MatterFieldConfidence
  jurisdiction?: string
}

export interface MatterParty {
  name: string
  role?: string
  side?: "claimant" | "respondent" | "applicant" | "other"
}

export interface MatterClaim {
  summary: string
  reliefSought?: string
}

export interface MatterDefence {
  summary: string
}

export interface StatuteRef {
  act: string
  section?: string
}

export interface PrecedentRef {
  citation: string
  title?: string
}

export interface EvidenceAnalysisFlags {
  admission?: boolean
  contradiction?: boolean
  paymentProof?: boolean
  threat?: boolean
}

export interface EvidenceRef {
  id?: string
  description: string
  sourceType?: string
  sourceDocumentId?: string
  date?: string
  party?: string
  docType?: string
  flags?: EvidenceAnalysisFlags
}

export interface MatterDocumentRef {
  id?: string
  title: string
  documentType?: string
}

export interface TimelineEvent {
  date?: string
  description: string
  eventType?: string
}

export interface MatterGraph {
  matterId?: string
  parties: MatterParty[]
  claims: MatterClaim[]
  defences: MatterDefence[]
  statutes: StatuteRef[]
  precedents: PrecedentRef[]
  evidence: EvidenceRef[]
  documents: MatterDocumentRef[]
  timeline: TimelineEvent[]
}

export interface MatterDeadline {
  label: string
  dueDate?: string
  description?: string
}

export interface MatterTaskGraph {
  recommendedActions: string[]
  requiredDocuments: string[]
  missingDocuments: string[]
  deadlines: MatterDeadline[]
  nextBestAction?: string
}

export type MatterProfileField = keyof MatterProfile | "nature" | "forum"

export interface ClarifyingQuestion {
  id: string
  text: string
  options?: string[]
  field: MatterProfileField
}

export type RecommendationMode = "matched" | "low_confidence" | "clarification_required"

export interface MatterClassificationResult {
  profile: MatterProfile
  graph?: MatterGraph
  taskGraph?: MatterTaskGraph
  clarifyingQuestions: ClarifyingQuestion[]
  shouldProceed: boolean
  recommendationMode: RecommendationMode
}
