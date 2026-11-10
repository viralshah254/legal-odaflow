export type LegacyActId =
  | 'ipc'
  | 'crpc'
  | 'iea'
  | 'ni_act'
  | 'pocso'
  | 'ndps'
  | 'pmla'
  | 'cpc'
  | 'other';

export type NewActId = 'bns' | 'bnss' | 'bsa' | 'unchanged';

export type TrialCourt =
  | 'magistrate_second_class'
  | 'magistrate_first_class'
  | 'chief_judicial_magistrate'
  | 'sessions'
  | 'special_court'
  | 'high_court'
  | 'supreme_court';

export type ChangeType =
  | 'substantially_re_enacted'
  | 're_enacted_with_additions'
  | 'merged'
  | 'split'
  | 'renumbered'
  | 'new_provision'
  | 'unchanged'
  | 'omitted';

export type SectionFinderTier = 'enriched' | 'crosswalk';

export type AmendmentOverlayChangeType =
  | 'amended'
  | 'inserted'
  | 'omitted'
  | 'repealed'
  | 'commencement_pending';

export interface SectionAmendmentOverlay {
  actId: string;
  sectionNumber: string;
  effectiveAsOf: string;
  lastVerifiedAt: string;
  amendingInstrument?: string;
  changeType?: AmendmentOverlayChangeType;
  summaryDelta?: string;
  sourceUrl?: string;
}

export interface SectionFinderEntry {
  id: string;
  legacyActId: LegacyActId;
  legacyActShort: string;
  legacyActFull: string;
  legacySection: string;
  legacyTitle: string;
  newActId: NewActId;
  newActShort: string;
  newActFull: string;
  newSection: string;
  newTitle: string;
  changeType: ChangeType;
  changeSummary: string;
  punishment: string;
  maxYears?: number;
  minYears?: number;
  isBailable: boolean;
  isCognizable: boolean;
  isCompoundable: boolean;
  trialCourt: TrialCourt;
  trialCourtLabel: string;
  bailPosture: string;
  practiceNote?: string;
  /** Full statutory provision text from bare-act corpus */
  sectionText?: string;
  transitionWarning?: string;
  sourceRef: string;
  transitionDate: string;
  matchSource?: 'curated' | 'remap' | 'corpus' | 'network' | 'ai';
  /** Present on AI-only rows — never treat as corpus-verified. */
  verificationState?: 'verified' | 'ai_suggested';
  /** enriched = full metadata; crosswalk = Schedule I mapping only */
  tier?: SectionFinderTier;
  /** false when section omitted/repealed under BNS/BNSS/BSA */
  isInForce?: boolean;
  successorSection?: string;
  successorActShort?: string;
  officialRemovalNote?: string;
  effectiveAsOf?: string;
  lastVerifiedAt?: string;
  amendingInstrument?: string;
  /** Linked LegalAuthority row when result comes from DB corpus */
  legalAuthorityId?: string;
}

export const LAW_CURRENCY_CUTOFF = '2026-06-30' as const;

export const OMITTED_SENTINELS = {
  punishment: 'Not applicable — section omitted',
  bailPosture: 'Not applicable — legacy section no longer in force',
} as const;
