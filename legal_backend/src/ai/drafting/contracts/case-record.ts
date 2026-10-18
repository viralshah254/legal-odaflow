/**
 * Universal Case Record — document-independent factual source of truth.
 * Matter-specific fields live in `matterData` extensions, not here.
 */

import { createHash } from 'crypto';

export type CaseRecordStatus = 'draft' | 'confirmed' | 'superseded';

export type FactSourceType =
  | 'user_input'
  | 'uploaded_document'
  | 'existing_matter'
  | 'model_inference';

export type FactStatus =
  | 'prosecution_allegation'
  | 'defence_version'
  | 'admitted'
  | 'disputed'
  | 'procedural_record';

export type FactConfidence = 'explicit' | 'inferred' | 'unknown';

export type FactMateriality = 'critical' | 'important' | 'background';

export type SourceHierarchyLevel =
  | 'court_order'
  | 'chargesheet'
  | 'fir'
  | 'filed_pleading'
  | 'user_confirmed_edit'
  | 'upload'
  | 'narrative'
  | 'model_inference';

export const SOURCE_HIERARCHY_RANK: Record<SourceHierarchyLevel, number> = {
  court_order: 100,
  chargesheet: 90,
  fir: 80,
  filed_pleading: 70,
  user_confirmed_edit: 60,
  upload: 50,
  narrative: 40,
  model_inference: 10,
};

export interface CaseRecordMetadata {
  caseRecordId: string;
  version: number;
  status: CaseRecordStatus;
  extractedAt: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  sourceHash: string;
  playbookId: string;
  playbookVersion: string;
}

export interface Jurisdiction {
  countryCode: string;
  stateOrRegion?: string;
  courtLevel?: string;
  courtName?: string;
}

export interface Party {
  id: string;
  role: string;
  name: string;
  aliases?: string[];
  description?: string;
}

export interface SourceLocation {
  documentId?: string;
  page?: number;
  paragraph?: number;
  startOffset?: number;
  endOffset?: number;
}

export interface CaseFact {
  id: string;
  displayId?: string;
  proposition: string;
  sourceQuote: string;
  sourceLocation?: SourceLocation;
  sourceType: FactSourceType;
  sourceHierarchy?: SourceHierarchyLevel;
  status: FactStatus;
  confidence: FactConfidence;
  /** Assigned by DraftTypeAdapter — never by CaseRecordExtractionService. */
  materiality?: FactMateriality;
  userApproved?: boolean;
}

export interface ChronologyEvent {
  id: string;
  label: string;
  date?: string;
  datePrecision?: 'exact' | 'approximate' | 'unknown';
  factIds: string[];
  sourceHierarchy?: SourceHierarchyLevel;
}

export interface EvidenceItem {
  id: string;
  type: string;
  description: string;
  supportsFactIds?: string[];
  weakensFactIds?: string[];
  sourceQuote?: string;
}

export interface LegalProvision {
  id: string;
  actId: string;
  section: string;
  raw: string;
  /** True when this is a charged/pleaded section (not a suggestion). */
  charged: boolean;
}

export interface SuggestedSection {
  id: string;
  actId: string;
  section: string;
  raw: string;
  reason: string;
  ingredientGaps?: string[];
}

export type ContradictionSeverity = 'blocker' | 'warning' | 'info';

export interface CaseContradiction {
  id: string;
  factId1: string;
  factId2: string;
  field?: string;
  description: string;
  severity: ContradictionSeverity;
  resolution?: {
    chosenFactId: string;
    resolvedByUserId: string;
    resolvedAt: string;
    note?: string;
  };
}

export interface MissingField {
  field: string;
  description: string;
  blocking: boolean;
  playbookFieldId?: string;
}

/** Structured money / valuation facts for filing-grade accuracy. */
export type MoneyRecordKind =
  | 'expense'
  | 'estimate'
  | 'claim'
  | 'premium'
  | 'court_fee'
  | 'other';

export type MoneyConfirmationState = 'extracted' | 'user_confirmed' | 'disputed' | 'missing';

export interface MoneyRecord {
  id: string;
  kind: MoneyRecordKind;
  /** Numeric amount when parseable; otherwise leave undefined and use amountLabel. */
  amount?: number;
  currency?: string;
  amountLabel: string;
  description: string;
  date?: string;
  disputed?: boolean;
  materiality?: FactMateriality;
  sourceFactIds?: string[];
  sourceDocumentIds?: string[];
  confirmationState?: MoneyConfirmationState;
}

export interface DraftFactLock<TPayload = unknown> {
  id: string;
  kind: string;
  version: number;
  status: 'extracted' | 'confirmed' | 'blocked';
  sourceHash: string;
  payload: TPayload;
  blockingIssues: string[];
}

export type FactDispositionKind =
  | 'affirmatively_use'
  | 'address_adverse_fact'
  | 'omit_as_legally_irrelevant'
  | 'requires_clarification';

export interface FactDisposition {
  factId: string;
  disposition: FactDispositionKind;
  issuePlanItemId?: string;
  reason: string;
}

export interface CaseRecord<TMatterData = unknown> {
  metadata: CaseRecordMetadata;
  jurisdiction: Jurisdiction;
  parties: Party[];
  facts: CaseFact[];
  chronology: ChronologyEvent[];
  evidence: EvidenceItem[];
  moneyRecords?: MoneyRecord[];
  /** Immutable structured values that generation and repair must reproduce exactly. */
  factLocks?: DraftFactLock[];
  statutes: LegalProvision[];
  suggestedStatutes: SuggestedSection[];
  contradictions: CaseContradiction[];
  missingFields: MissingField[];
  factDispositions?: FactDisposition[];
  matterData: TMatterData;
}

/** Stable fact ID — not positional. */
export function buildStableFactId(input: {
  sourceQuote: string;
  proposition: string;
  documentId?: string;
}): string {
  const normalized = [
    normalizeFactText(input.sourceQuote),
    normalizeFactText(input.proposition),
    input.documentId ?? '',
  ].join('|');
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  return `FACT_${hash}`;
}

export function normalizeFactText(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s./-]/g, '')
    .trim();
}

export function buildSourceHash(rawInput: string, documentIds: string[] = []): string {
  const payload = `${normalizeFactText(rawInput)}|${documentIds.slice().sort().join(',')}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function createCaseRecordId(): string {
  const stamp = Date.now().toString(36);
  const rand = createHash('sha256').update(`${stamp}-${Math.random()}`).digest('hex').slice(0, 8);
  return `CR_${stamp}_${rand}`;
}

/** model_inference facts must not render unless userApproved. */
export function isRenderableFact(fact: CaseFact): boolean {
  if (fact.sourceType === 'model_inference') {
    return fact.userApproved === true;
  }
  return true;
}
