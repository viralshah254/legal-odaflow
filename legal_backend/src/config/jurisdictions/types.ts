/**
 * Jurisdiction profile types shared by the deep country modules and the
 * universal jurisdiction engine. These structures feed AI prompts (citation
 * style, court hierarchy, ADR pathways) and product UI (practice-area chips).
 */

export type LegalSystem =
  | 'common_law'
  | 'civil_law'
  | 'religious'
  | 'customary'
  | 'mixed';

export type JurisdictionTier = 'deep' | 'best_effort';

export interface PracticeArea {
  /** Display name, e.g. "Consumer protection". */
  name: string;
  /** Primary statutes/codes that govern the area. */
  keyStatutes: string[];
}

export interface CourtLevel {
  name: string;
  /** apex | appellate | superior | trial | tribunal | specialised */
  role: string;
}

export interface AdrPathway {
  mechanism: string;
  isLegallyBinding: boolean;
  note?: string;
}

/** A fully-specified ("deep") jurisdiction encoded by hand. */
export interface DeepJurisdictionProfile {
  code: string;
  name: string;
  legalSystem: LegalSystem;
  languageOfRecord: string[];
  /** Example citation formats the model should follow for this jurisdiction. */
  citationStyle: string[];
  courtHierarchy: CourtLevel[];
  practiceAreas: PracticeArea[];
  adrPathways: AdrPathway[];
  /** How limitation/prescription periods work + the governing statute. */
  limitationNotes: string;
  /** Where primary legislation lives / how it is cited. */
  primaryLegislationStyle: string;
}

/** Resolved profile for any country, deep or best-effort. */
export interface JurisdictionProfile extends DeepJurisdictionProfile {
  tier: JurisdictionTier;
  /** Sub-national jurisdiction if provided (e.g. "Maharashtra"). */
  jurisdiction?: string;
  /** Formatted location, e.g. "Maharashtra, India". */
  legalLocation: string;
}
