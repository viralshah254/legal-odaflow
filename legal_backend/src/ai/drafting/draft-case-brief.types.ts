/** Structured case brief — source of truth for lawyer-ready drafting. */

export type ProceduralStage =
  | 'pre_fir'
  | 'investigation'
  | 'post_chargesheet'
  | 'trial'
  | 'unknown';

export interface BriefParty {
  role:
    | 'applicant'
    | 'accused'
    | 'complainant'
    | 'petitioner'
    | 'respondent'
    | 'plaintiff'
    | 'defendant'
    | 'co_accused'
    | 'state'
    | 'other';
  name: string;
}

export interface BriefCitedStatute {
  actId: string;
  section: string;
  raw: string;
}

export interface BriefEvidenceItem {
  id: string;
  type: string;
  description: string;
  supports?: string;
  weakens?: string;
}

export interface DraftCaseBrief {
  parties: BriefParty[];
  proceduralHistory: {
    firDate?: string;
    firNo?: string;
    policeStation?: string;
    arrestDate?: string;
    chargesheetDate?: string;
    custodyDays?: number;
    coAccusedBailGranted?: boolean;
  };
  proceduralStage: ProceduralStage;
  prosecutionFacts: string[];
  defenceFacts: string[];
  evidenceItems: BriefEvidenceItem[];
  contradictions: string[];
  citedOffences: BriefCitedStatute[];
  /** One required ground per defence fact / contradiction. */
  requiredGrounds: string[];
  draftingConstraints: string[];
  blanks: { firNo?: boolean; policeStation?: boolean; firDate?: boolean };
  /** True when critical filing facts are missing. */
  intakeIncomplete: boolean;
  missingCriticalFields: string[];
  rawSummary: string;
  extractedAt: string;
}
