export type DraftArchetype =
  | 'criminal_bail'
  | 'anticipatory_bail'
  | 'civil_plaint'
  | 'writ_hc'
  | 'writ_sc'
  | 'ni_act_complaint'
  | 'maintenance'
  | 'legal_notice'
  | 'fir_complaint'
  | 'magistrate_complaint'
  | 'revision'
  | 'appeal'
  | 'discharge'
  | 'slp'
  | 'habeas'
  | 'consumer_complaint'
  | 'consumer_interim'
  | 'family_matrimonial'
  | 'research_memo'
  | 'generic_filing';

export type DraftCitationPolicy =
  | 'none'
  | 'statutes_only'
  | 'case_law_when_material'
  | 'case_law_required';

export type PreferredCourtTier = 'supreme' | 'high' | 'district' | 'any';

export interface DraftKindPlaybook {
  kind: string;
  archetype: DraftArchetype;
  jurisdiction?: string;
  filingGrade: boolean;
  partyLabel: string;
  requiredSections: string[];
  minCitationsPerGround: number;
  minVerifiedCaseAuthorities: number;
  requiredGroundTypes: string[];
  proceduralVehicles: string[];
  factCoverageThreshold: number;
  /** Fact category keys that must appear in CaseRecord for filing-grade. */
  requiredFactCategories?: string[];
  /** Assertions that must not appear as established facts. */
  prohibitedAssertions?: string[];
  /** Companion document kinds expected in a filing set. */
  companionDocuments?: string[];
  /** Source policy used by retrieval, verification, and release gates. */
  citationPolicy?: DraftCitationPolicy;
  /** Proposition topics that the verified authority set should cover. */
  requiredAuthorityTopics?: string[];
  /** Preferred minimum court tier for case-law retrieval. */
  preferredCourtTier?: PreferredCourtTier;
  /** Whether a case-law shortfall should trigger bounded deep research. */
  escalateAuthorityShortfall?: boolean;
  /** Statutes that are in-domain for this kind. */
  permittedStatutes?: string[];
  /** Legal domains that should be excluded from retrieval. */
  excludedAuthorityDomains?: string[];
}

/** Alias map: runtime kind → playbook kind / taxonomy key. */
export const KIND_ALIASES: Record<string, string> = {
  india_regular_bail_bnss_480: 'india_bail_application',
  india_anticipatory_bail_bnss_482: 'india_anticipatory_bail',
  india_maintenance_order_revision: 'india_maintenance',
  summary_suit_recovery: 'india_suit_recovery_cpc_37',
  money_recovery_suit: 'india_suit_recovery_cpc_37',
  india_civil_suit_money_recovery: 'india_suit_recovery_cpc_37',
};
