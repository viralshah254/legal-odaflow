/** Stable, serializable representation of a matter after intake normalization. */

export interface PartyRef {
  role: 'petitioner' | 'respondent' | 'plaintiff' | 'defendant' | 'appellant' | 'applicant' | 'accused' | 'other';
  name: string;
  description?: string;
  address?: string;
  ageOrDesignation?: string;
}

export interface FactItem {
  id: string;
  statement: string;
  status: 'confirmed' | 'alleged' | 'disputed' | 'uncertain';
  source: 'user' | 'matter' | 'attachment' | 'court_record';
  sourceReference?: string;
  date?: string;
}

export interface DateItem {
  id: string;
  label: string;
  date: string;
  factIds: string[];
}

export interface ReliefItem {
  id: string;
  description: string;
  type: 'primary' | 'interim' | 'costs' | 'ancillary';
}

export interface ProceduralEvent {
  id: string;
  description: string;
  date?: string;
  court?: string;
  orderReference?: string;
}

export interface AssertionItem {
  id: string;
  text: string;
  confidence: 'high' | 'medium' | 'low';
  factIds: string[];
}

export interface MissingInput {
  field: string;
  description: string;
  blocking: boolean;
}

export interface Contradiction {
  factId1: string;
  factId2: string;
  description: string;
}

export interface CourtRef {
  name: string;
  jurisdiction: string;
  level: 'supreme' | 'high' | 'district' | 'tribunal' | 'consumer' | 'family' | 'other';
  city?: string;
}

export interface NormalizedMatter {
  id: string;
  jurisdiction: string;
  documentKind: string;
  court?: CourtRef;
  parties: PartyRef[];
  facts: FactItem[];
  dates: DateItem[];
  requestedRelief: ReliefItem[];
  proceduralHistory: ProceduralEvent[];
  userAssertions: AssertionItem[];
  missingInputs: MissingInput[];
  contradictions: Contradiction[];
  sourceDocumentIds: string[];
  rawUserInput: string;
  normalizedAt: string;
  /** True when facts were merged from a confirmed CaseRecord. */
  caseRecordBacked?: boolean;
}
