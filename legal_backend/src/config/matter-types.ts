export const MATTER_TYPES = {
  LITIGATION: 'Litigation',       // court proceedings, hearings, trials
  ADVISORY: 'Advisory',           // legal opinion, advice note, memo
  TRANSACTION: 'Transaction',     // M&A, conveyancing, commercial deals
  DISPUTE: 'Dispute',             // ADR, arbitration, mediation, negotiation
  REGISTRATION: 'Registration',   // IP, company, property registration
  COMPLIANCE: 'Compliance',       // regulatory, tax, corporate governance
  DRAFTING: 'Drafting',           // contracts, wills, deeds, policies
} as const;

export type MatterType = (typeof MATTER_TYPES)[keyof typeof MATTER_TYPES];

export const MATTER_TYPE_VALUES = Object.values(MATTER_TYPES);

/** Default matter type for each practice area */
export const PRACTICE_AREA_DEFAULT_MATTER_TYPE: Record<string, MatterType> = {
  litigation_disputes: MATTER_TYPES.LITIGATION,
  real_estate_property: MATTER_TYPES.TRANSACTION,
  intellectual_property: MATTER_TYPES.REGISTRATION,
  corporate_commercial: MATTER_TYPES.TRANSACTION,
  tax: MATTER_TYPES.COMPLIANCE,
  wills_estates_probate: MATTER_TYPES.DRAFTING,
  employment_labour: MATTER_TYPES.DISPUTE,
  family_matrimonial: MATTER_TYPES.LITIGATION,
  criminal_defense: MATTER_TYPES.LITIGATION,
  immigration: MATTER_TYPES.REGISTRATION,
};

/**
 * Per-issue-type matter type overrides for intake-driven matter creation.
 * Keyed by the display label returned by the AI classifier (IssueCheckerType).
 * Takes priority over PRACTICE_AREA_DEFAULT_MATTER_TYPE.
 */
export const ISSUE_TYPE_MATTER_TYPE_OVERRIDE: Record<string, MatterType> = {
  'Contract & Document Drafting': MATTER_TYPES.DRAFTING,
  'Wills, Estates & Probate':     MATTER_TYPES.DRAFTING,
};

export function defaultMatterTypeForPracticeArea(
  practiceArea: string,
): MatterType {
  return (
    PRACTICE_AREA_DEFAULT_MATTER_TYPE[practiceArea] ?? MATTER_TYPES.ADVISORY
  );
}
