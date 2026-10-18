import { INDIA_DRAFT_KINDS } from '@/ai/india-draft/india-draft-prompts';
import { MATTER_TAXONOMY } from './matter-taxonomy';
import type { LegalAssetMetadata, MatterNature } from './matter-intelligence.types';

const KIND_PREFIX_RULES: Array<{
  prefix: RegExp;
  practiceArea: string;
  subPracticeArea?: string;
  nature: MatterNature;
  forum?: string;
}> = [
  { prefix: /^india_wrongful_termination|^india_labour_court|^india_industrial_tribunal|^india_posh|^india_pf_|^india_gratuity|^india_show_cause_reply|^india_workmen/, practiceArea: 'employment_labour', subPracticeArea: 'wrongful_termination', nature: 'dispute', forum: 'labour_court' },
  { prefix: /^india_employment|^india_offer|^india_appointment/, practiceArea: 'employment_labour', subPracticeArea: 'employment_contract', nature: 'transaction' },
  { prefix: /^india_maintenance|^india_hma|^india_domestic_violence|^india_divorce|^india_family/, practiceArea: 'family_matrimonial', nature: 'dispute', forum: 'family_court' },
  { prefix: /^india_bail|^india_quashing|^india_criminal|^india_fir|^india_cheque_bounce/, practiceArea: 'litigation_disputes', subPracticeArea: 'criminal_fir_bail', nature: 'dispute' },
  { prefix: /^india_suit_recovery_cpc_37|^india_civil_suit_money_recovery/, practiceArea: 'corporate_commercial', subPracticeArea: 'commercial_recovery', nature: 'dispute', forum: 'commercial_court' },
  { prefix: /^india_writ|^india_slp|^india_civil_plaint|^india_civil_appeal|^india_civil_revision/, practiceArea: 'litigation_disputes', nature: 'dispute' },
  { prefix: /^india_arbitration|^india_s9_|^india_s11_|^india_s34_|^india_s36_|^india_statement_of_claim_arb|^india_mediation/, practiceArea: 'arbitration_adr', nature: 'dispute', forum: 'arbitral_tribunal' },
  { prefix: /^india_consumer|^india_legal_notice_consumer/, practiceArea: 'consumer', nature: 'dispute' },
  { prefix: /^india_nda|^india_service_agreement|^india_partnership|^india_share|^india_mou|^india_loan/, practiceArea: 'corporate_commercial', nature: 'transaction' },
  { prefix: /^india_lease|^india_sale_deed|^india_mortgage|^india_property/, practiceArea: 'real_estate_property', nature: 'transaction' },
  { prefix: /^india_ibc_|^india_insolvency|^india_resolution_plan/, practiceArea: 'insolvency', nature: 'dispute' },
  { prefix: /^india_gst|^india_income_tax|^india_tax/, practiceArea: 'tax', nature: 'compliance' },
  { prefix: /^india_will|^india_probate|^india_succession|^india_trust/, practiceArea: 'estates_wills', nature: 'transaction' },
  { prefix: /^us_state_domestic|^us_state_llc|^us_/, practiceArea: 'corporate_commercial', nature: 'transaction', forum: 'state_court' },
];

function inferMetadataFromKind(curatedKind: string): LegalAssetMetadata {
  for (const rule of KIND_PREFIX_RULES) {
    if (rule.prefix.test(curatedKind)) {
      return {
        practiceArea: rule.practiceArea,
        subPracticeArea: rule.subPracticeArea,
        nature: rule.nature,
        forum: rule.forum,
        curatedKind,
        jurisdiction: curatedKind.startsWith('india_') ? 'IN' : undefined,
      };
    }
  }
  return {
    practiceArea: 'litigation_disputes',
    nature: 'dispute',
    curatedKind,
  };
}

function buildTaxonomyMetadata(): Record<string, LegalAssetMetadata> {
  const map: Record<string, LegalAssetMetadata> = {};
  for (const domain of MATTER_TAXONOMY) {
    for (const sub of domain.subAreas) {
      for (const kind of sub.curatedKinds ?? []) {
        map[kind] = {
          practiceArea: domain.slug,
          subPracticeArea: sub.slug,
          nature: sub.slug.includes('contract') || sub.slug === 'nda' || sub.slug === 'msa' ? 'transaction' : 'dispute',
          forum: sub.forums[0],
          curatedKind: kind,
          jurisdiction: 'IN',
        };
      }
    }
  }
  return map;
}

const TAXONOMY_METADATA = buildTaxonomyMetadata();

/** Explicit overrides for high-traffic curated kinds. */
const CURATED_OVERRIDES: Record<string, LegalAssetMetadata> = {
  india_wrongful_termination: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'dispute',
    forum: 'labour_court',
    documentType: 'wrongful_termination_petition',
    curatedKind: 'india_wrongful_termination',
    jurisdiction: 'IN',
  },
  india_labour_court_application: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'dispute',
    forum: 'labour_court',
    documentType: 'labour_court_application',
    curatedKind: 'india_labour_court_application',
    jurisdiction: 'IN',
  },
  india_employment_legal_opinion: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'advisory',
    documentType: 'employment_legal_opinion',
    curatedKind: 'india_employment_legal_opinion',
    jurisdiction: 'IN',
  },
  india_illegal_termination_demand_notice: {
    practiceArea: 'employment_labour',
    subPracticeArea: 'wrongful_termination',
    nature: 'dispute',
    stage: 'pre_filing',
    documentType: 'illegal_termination_demand_notice',
    curatedKind: 'india_illegal_termination_demand_notice',
    jurisdiction: 'IN',
  },
  india_arbitration_notice_s21: {
    practiceArea: 'arbitration_adr',
    subPracticeArea: 'arbitration',
    nature: 'dispute',
    forum: 'arbitral_tribunal',
    curatedKind: 'india_arbitration_notice_s21',
    jurisdiction: 'IN',
  },
};

export const LEGAL_ASSET_METADATA: Record<string, LegalAssetMetadata> = (() => {
  const registry: Record<string, LegalAssetMetadata> = { ...TAXONOMY_METADATA, ...CURATED_OVERRIDES };
  for (const kind of INDIA_DRAFT_KINDS) {
    if (!registry[kind]) {
      registry[kind] = inferMetadataFromKind(kind);
    }
  }
  return registry;
})();

export function getLegalAssetMetadata(
  assetId: string,
  fallback?: Partial<LegalAssetMetadata>,
): LegalAssetMetadata | undefined {
  return LEGAL_ASSET_METADATA[assetId] ?? (fallback ? { ...fallback, curatedKind: assetId } as LegalAssetMetadata : undefined);
}

export function scoreMetadataMatch(
  asset: LegalAssetMetadata,
  profile: { practiceArea: string; subPracticeArea?: string; nature: MatterNature; forum?: string },
  excludePracticeAreas: string[] = [],
): number {
  if (excludePracticeAreas.includes(asset.practiceArea)) return 0;

  let score = 0;
  if (asset.practiceArea === profile.practiceArea) score += 0.45;
  else if (asset.practiceArea !== profile.practiceArea) score -= 0.35;

  if (profile.subPracticeArea && asset.subPracticeArea === profile.subPracticeArea) score += 0.25;
  if (asset.nature === profile.nature) score += 0.15;
  else if (profile.nature === 'dispute' && asset.nature === 'transaction') score -= 0.2;

  if (profile.forum && asset.forum === profile.forum) score += 0.1;

  return Math.max(0, Math.min(1, score));
}
