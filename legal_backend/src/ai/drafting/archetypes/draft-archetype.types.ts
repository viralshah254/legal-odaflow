import type { GoverningSection } from '@/ai/drafting/draft-procedural-router.types';

/** Cross-jurisdiction draft register (prompt + linter rules). */
export type DraftRegister =
  | 'police_complaint'
  | 'magistrate_complaint'
  | 'protective_order'
  | 'bail_application'
  | 'court_petition'
  | 'civil_plaint'
  | 'appellate'
  | 'writ'
  | 'notice_letter'
  | 'special_statute'
  | 'family_petition'
  | 'supporting'
  | 'unknown';

/** High-level document archetype shared by IN and US. */
export type DraftArchetypeId =
  | 'police_criminal_complaint'
  | 'magistrate_private_complaint'
  | 'protective_order'
  | 'bail_release'
  | 'criminal_trial_pleading'
  | 'civil_plaint'
  | 'appellate_revision'
  | 'writ_constitutional'
  | 'regulatory_notice'
  | 'special_statute_complaint'
  | 'family_matrimonial'
  | 'supporting_filing'
  | 'other';

export type ArchetypeJurisdiction = 'IN' | 'US';

export interface ArchetypeSectionRef {
  actId: string;
  section: string;
  label: string;
  predecessor?: { actId: string; section: string };
}

export interface ProceduralVehicle {
  forum: string;
  sections: ArchetypeSectionRef[];
  kind: string;
  /** Human-readable when-clause; matched loosely against facts/intent. */
  when: string;
  whenPattern?: RegExp;
}

export interface AltStatuteRule {
  actId: string;
  section: string;
  label: string;
  when: RegExp;
}

/**
 * Hand-verified offence/case row. Every section must have sourceRefs —
 * never invent statutes at generation time.
 */
export interface DraftArchetypeEntry {
  id: string;
  jurisdiction: ArchetypeJurisdiction;
  archetype: DraftArchetypeId;
  offenceFamily: string;
  /** Regex signals matched against case details / query. */
  signals: RegExp[];
  substantiveSections: ArchetypeSectionRef[];
  proceduralVehicles: ProceduralVehicle[];
  altStatutes?: AltStatuteRule[];
  register: DraftRegister;
  /** Schedule I / corpus provenance keys. */
  sourceRefs: string[];
  /** Optional bailability note for linters (IN Schedule 1 / US bail factors). */
  bailabilityNote?: string;
  /** Priority when multiple entries match (higher wins). */
  priority?: number;
}

export interface ArchetypeRouteInput {
  jurisdiction: ArchetypeJurisdiction;
  caseDetails: string;
  documentKind?: string;
  offenceDate?: string;
  filingDate?: string;
  /** User intent hints: police, magistrate, protective, bail, etc. */
  forumIntent?: string;
}

export interface ArchetypeRouteResult {
  matched: boolean;
  entry?: DraftArchetypeEntry;
  archetype: DraftArchetypeId;
  register: DraftRegister;
  recommendedKind?: string;
  substantiveSections: GoverningSection[];
  proceduralSections: GoverningSection[];
  governingSections: GoverningSection[];
  warnings: string[];
  missingFacts: string[];
  sourceRefs: string[];
}

export function kindToArchetype(kind: string): DraftArchetypeId {
  const k = kind.toLowerCase();
  if (/fir_complaint|police_complaint|cyber_crime|criminal_complaint|victim_statement/.test(k)) {
    return 'police_criminal_complaint';
  }
  if (/complaint_magistrate|cheque_bounce|ni138|private_complaint/.test(k)) {
    return 'magistrate_private_complaint';
  }
  if (/domestic_violence|pwdva|posh|restraining|protective|harassment_order/.test(k)) {
    return 'protective_order';
  }
  if (/bail|detention|remand|pretrial/.test(k)) return 'bail_release';
  if (/discharge|charge_framing|quashing|suppression|motion_dismiss|plea|sentencing/.test(k)) {
    return 'criminal_trial_pleading';
  }
  if (/appeal|revision|review|notice_of_appeal/.test(k)) return 'appellate_revision';
  if (/writ|habeas|article_226|article_32|1983|mandamus|certiorari/.test(k)) {
    return 'writ_constitutional';
  }
  if (/notice|demand|cease|legal_notice/.test(k)) return 'regulatory_notice';
  if (/consumer|arbitration|nclt|tax|gst|uscis|irs|form_|immigration|insolvency/.test(k)) {
    return 'special_statute_complaint';
  }
  if (/divorce|custody|maintenance|matrimonial|adoption|guardianship|hma|sma|gwa|support|family/.test(k)) {
    return 'family_matrimonial';
  }
  if (/plaint|injunction|suit|civil|specific_performance|recovery|execution|cpc|complaint|answer|counterclaim|breach|contract|tort/.test(k)) {
    return 'civil_plaint';
  }
  if (/affidavit|vakalatnama|memo|application/.test(k)) return 'supporting_filing';
  return 'other';
}

export function archetypeToRegister(archetype: DraftArchetypeId): DraftRegister {
  const map: Record<DraftArchetypeId, DraftRegister> = {
    police_criminal_complaint: 'police_complaint',
    magistrate_private_complaint: 'magistrate_complaint',
    protective_order: 'protective_order',
    bail_release: 'bail_application',
    criminal_trial_pleading: 'court_petition',
    civil_plaint: 'civil_plaint',
    appellate_revision: 'appellate',
    writ_constitutional: 'writ',
    regulatory_notice: 'notice_letter',
    special_statute_complaint: 'special_statute',
    family_matrimonial: 'family_petition',
    supporting_filing: 'supporting',
    other: 'unknown',
  };
  return map[archetype];
}

export function toGoverningSection(ref: ArchetypeSectionRef): GoverningSection {
  return {
    actId: ref.actId,
    section: ref.section,
    label: ref.label,
    predecessor: ref.predecessor,
  };
}
