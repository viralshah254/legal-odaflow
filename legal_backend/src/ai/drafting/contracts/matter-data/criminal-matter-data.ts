/** Criminal matter extension for CaseRecord.matterData */

export type FieldState = 'known' | 'missing' | 'conflicted' | 'not_applicable';

export interface FirDetails {
  firNo?: string;
  firDate?: string;
  policeStation?: string;
  fieldStates?: Partial<Record<'firNo' | 'firDate' | 'policeStation', FieldState>>;
}

export interface ArrestDetails {
  arrestDate?: string;
  custodyDays?: number;
  fieldStates?: Partial<Record<'arrestDate' | 'custodyDays', FieldState>>;
}

export type CustodyStatus =
  | 'in_custody'
  | 'on_bail'
  | 'not_arrested'
  | 'surrendered'
  | 'unknown';

export type FilingStatus = 'not_filed' | 'filed' | 'unknown';

export interface AccusedPerson {
  id: string;
  name: string;
  isApplicant?: boolean;
  role?: 'applicant' | 'co_accused' | 'other';
}

export interface ChargedSection {
  actId: string;
  section: string;
  raw: string;
  ingredientGaps?: string[];
}

export interface RecoveryItem {
  description: string;
  disputed?: boolean;
  sourceQuote?: string;
}

export interface BailHistoryItem {
  accusedName: string;
  granted: boolean;
  date?: string;
  court?: string;
  sourceQuote?: string;
}

export interface CriminalAntecedent {
  description: string;
  sourceQuote?: string;
}

export interface BailCaseChecklist {
  fields: Record<string, { state: FieldState; value?: string; note?: string }>;
}

export const BAIL_CHECKLIST_FIELDS = [
  'applicantName',
  'firNo',
  'firDate',
  'policeStation',
  'arrestDate',
  'custodyStatus',
  'chargesheetStatus',
  'chargedSections',
  'courtName',
  'coAccusedBail',
  'recoveryPosition',
  'defenceFacts',
  'antecedents',
  'remedySought',
  'jurisdiction',
  'proceduralStage',
] as const;

export type BailChecklistField = (typeof BAIL_CHECKLIST_FIELDS)[number];

export interface CriminalMatterData {
  firDetails?: FirDetails;
  arrestDetails?: ArrestDetails;
  custodyStatus?: CustodyStatus;
  chargesheetStatus?: FilingStatus;
  proceduralStage?:
    | 'pre_fir'
    | 'investigation'
    | 'post_chargesheet'
    | 'trial'
    | 'unknown';
  accusedPersons: AccusedPerson[];
  allegedOffences: ChargedSection[];
  recoveryDetails: RecoveryItem[];
  priorBailHistory: BailHistoryItem[];
  antecedents?: CriminalAntecedent[];
  bailChecklist?: BailCaseChecklist;
}

export function emptyCriminalMatterData(): CriminalMatterData {
  return {
    accusedPersons: [],
    allegedOffences: [],
    recoveryDetails: [],
    priorBailHistory: [],
  };
}
