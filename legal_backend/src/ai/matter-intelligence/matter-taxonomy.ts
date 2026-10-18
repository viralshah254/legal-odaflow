/**
 * Matter taxonomy registry — maps practice areas to sub-areas, forums, remedies, document types.
 * Aligned with PLATFORM_DOMAINS in config/taxonomy/platform-taxonomy.ts
 */

export interface SubPracticeDefinition {
  slug: string;
  label: string;
  forums: string[];
  remedies: string[];
  documentTypes: string[];
  curatedKinds: string[];
  excludePracticeAreas?: string[];
}

export interface PracticeAreaDefinition {
  slug: string;
  label: string;
  subAreas: SubPracticeDefinition[];
}

export const MATTER_TAXONOMY: PracticeAreaDefinition[] = [
  {
    slug: 'employment_labour',
    label: 'Employment & Labour',
    subAreas: [
      {
        slug: 'wrongful_termination',
        label: 'Wrongful Termination',
        forums: ['labour_court', 'industrial_tribunal', 'labour_commissioner'],
        remedies: ['reinstatement', 'back_wages', 'compensation', 'continuity_of_service'],
        documentTypes: ['legal_opinion', 'demand_notice', 'labour_court_petition', 'statement_of_claim'],
        curatedKinds: [
          'india_employment_legal_opinion',
          'india_illegal_termination_demand_notice',
          'india_wrongful_termination',
          'india_labour_court_application',
        ],
        excludePracticeAreas: ['arbitration_adr', 'corporate_commercial'],
      },
      {
        slug: 'wage_dispute',
        label: 'Wage Dispute',
        forums: ['labour_court', 'labour_commissioner'],
        remedies: ['unpaid_wages', 'overtime', 'bonus'],
        documentTypes: ['demand_notice', 'labour_court_petition'],
        curatedKinds: ['india_labour_court_application', 'india_wrongful_termination'],
        excludePracticeAreas: ['arbitration_adr'],
      },
      {
        slug: 'posh',
        label: 'POSH / Workplace Harassment',
        forums: ['internal_committee', 'court'],
        remedies: ['inquiry', 'compensation', 'reinstatement'],
        documentTypes: ['posh_complaint', 'legal_notice'],
        curatedKinds: ['india_posh_complaint'],
      },
      {
        slug: 'unfair_labour_practice',
        label: 'Unfair Labour Practice',
        forums: ['labour_court', 'industrial_tribunal'],
        remedies: ['reinstatement', 'compensation'],
        documentTypes: ['industrial_dispute_petition'],
        curatedKinds: ['india_industrial_tribunal_ref', 'india_labour_court_application'],
      },
    ],
  },
  {
    slug: 'family_matrimonial',
    label: 'Family & Matrimonial',
    subAreas: [
      {
        slug: 'maintenance',
        label: 'Maintenance',
        forums: ['family_court', 'magistrate', 'high_court'],
        remedies: ['interim_maintenance', 'final_maintenance', 'revision'],
        documentTypes: ['maintenance_application', 'maintenance_revision', 'maintenance_appeal'],
        curatedKinds: [
          'india_maintenance_application_bnss_144',
          'india_maintenance_order_revision',
          'india_maintenance_appeal_final',
        ],
        excludePracticeAreas: ['litigation_disputes'],
      },
      {
        slug: 'divorce',
        label: 'Divorce',
        forums: ['family_court'],
        remedies: ['divorce_decree', 'alimony', 'custody'],
        documentTypes: ['divorce_petition', 'judicial_separation', 'restitution_conjugal_rights'],
        curatedKinds: [
          'india_divorce_petition_s13',
          'india_divorce_mutual_consent',
          'india_written_statement',
          'india_restitution_conjugal_rights',
        ],
      },
      {
        slug: 'domestic_violence',
        label: 'Domestic Violence',
        forums: ['magistrate', 'family_court'],
        remedies: ['protection_order', 'residence_order', 'monetary_relief'],
        documentTypes: ['dv_petition', 'protection_order'],
        curatedKinds: ['india_domestic_violence_petition'],
      },
      {
        slug: 'custody',
        label: 'Child Custody',
        forums: ['family_court', 'guardian_court'],
        remedies: ['custody', 'visitation'],
        documentTypes: ['custody_petition'],
        curatedKinds: ['india_child_custody'],
      },
    ],
  },
  {
    slug: 'litigation_disputes',
    label: 'Litigation',
    subAreas: [
      {
        slug: 'criminal_complaint_filing',
        label: 'Criminal — Complaint Filing',
        forums: ['magistrate', 'police_station'],
        remedies: ['fir_registration', 'magistrate_complaint', 'private_complaint'],
        documentTypes: ['police_complaint', 'criminal_complaint'],
        curatedKinds: [
          'india_fir_complaint',
          'india_cyber_crime_complaint',
          'india_complaint_magistrate_bnss_223',
        ],
      },
      {
        slug: 'criminal_fir_bail',
        label: 'Criminal — FIR & Bail',
        forums: ['sessions_court', 'high_court', 'magistrate'],
        remedies: ['bail', 'anticipatory_bail', 'quashing'],
        documentTypes: ['bail_application', 'anticipatory_bail', 'quashing_petition'],
        curatedKinds: [
          'india_regular_bail_bnss_480',
          'india_anticipatory_bail_bnss_482',
          'india_quashing_petition_bnss_528',
        ],
      },
      {
        slug: 'civil_suits',
        label: 'Civil Suits',
        forums: ['district_court', 'high_court'],
        remedies: ['injunction', 'damages', 'specific_performance'],
        documentTypes: ['plaint', 'written_statement', 'injunction_application'],
        curatedKinds: ['india_civil_plaint', 'india_civil_revision'],
      },
      {
        slug: 'appeals_revision',
        label: 'Appeals & Revision',
        forums: ['high_court', 'supreme_court'],
        remedies: ['appeal', 'revision', 'slp'],
        documentTypes: ['appeal', 'revision_petition', 'slp'],
        curatedKinds: ['india_criminal_appeal', 'india_civil_appeal_hc', 'india_criminal_revision'],
      },
      {
        slug: 'writ',
        label: 'Writ Petitions',
        forums: ['high_court', 'supreme_court'],
        remedies: ['writ', 'mandamus', 'certiorari'],
        documentTypes: ['writ_petition'],
        curatedKinds: ['india_habeas_corpus_petition', 'india_writ_petition_hc', 'india_article_227_petition'],
      },
    ],
  },
  {
    slug: 'consumer',
    label: 'Consumer',
    subAreas: [
      {
        slug: 'deficiency_of_service',
        label: 'Deficiency of Service',
        forums: ['consumer_commission', 'district_commission'],
        remedies: ['refund', 'compensation', 'replacement'],
        documentTypes: ['consumer_complaint', 'legal_notice'],
        curatedKinds: ['india_consumer_complaint'],
        excludePracticeAreas: ['corporate_commercial'],
      },
      {
        slug: 'defective_product',
        label: 'Defective Product',
        forums: ['consumer_commission'],
        remedies: ['refund', 'compensation', 'product_replacement'],
        documentTypes: ['consumer_complaint'],
        curatedKinds: ['india_consumer_complaint'],
      },
    ],
  },
  {
    slug: 'real_estate_property',
    label: 'Real Estate',
    subAreas: [
      {
        slug: 'eviction',
        label: 'Eviction',
        forums: ['civil_court', 'rent_control'],
        remedies: ['possession', 'mesne_profits'],
        documentTypes: ['eviction_suit', 'notice_to_quit'],
        curatedKinds: ['india_civil_plaint'],
      },
      {
        slug: 'specific_performance',
        label: 'Specific Performance',
        forums: ['civil_court'],
        remedies: ['specific_performance', 'damages'],
        documentTypes: ['plaint', 'injunction', 'legal_notice'],
        curatedKinds: [
          'india_legal_notice',
          'india_civil_plaint',
          'india_application_temp_injunction',
          'india_suit_specific_performance',
        ],
      },
    ],
  },
  {
    slug: 'corporate_commercial',
    label: 'Corporate & Commercial',
    subAreas: [
      {
        slug: 'commercial_recovery',
        label: 'Commercial Debt Recovery',
        forums: ['commercial_court', 'district_court', 'high_court'],
        remedies: ['recovery', 'contractual_interest', 'costs'],
        documentTypes: ['summary_suit_recovery', 'money_recovery_suit'],
        curatedKinds: [
          'india_suit_recovery_cpc_37',
          'india_civil_suit_money_recovery',
        ],
        excludePracticeAreas: [
          'family_matrimonial',
          'consumer',
          'regulatory_compliance',
        ],
      },
      {
        slug: 'nda',
        label: 'NDA / Confidentiality',
        forums: [],
        remedies: [],
        documentTypes: ['nda', 'confidentiality_agreement'],
        curatedKinds: ['india_nda_mutual', 'india_nda_unilateral'],
      },
      {
        slug: 'msa',
        label: 'Service Agreement / MSA',
        forums: [],
        remedies: [],
        documentTypes: ['service_agreement', 'msa'],
        curatedKinds: ['india_service_agreement_india'],
      },
      {
        slug: 'shareholders',
        label: 'Shareholders / Founders',
        forums: [],
        remedies: [],
        documentTypes: ['shareholders_agreement', 'founders_agreement'],
        curatedKinds: ['india_shareholders_agreement', 'india_partnership_deed'],
      },
      {
        slug: 'employment_contract',
        label: 'Employment Contract',
        forums: [],
        remedies: [],
        documentTypes: ['employment_contract', 'offer_letter'],
        curatedKinds: ['india_employment_agreement_india'],
      },
    ],
  },
  {
    slug: 'arbitration_adr',
    label: 'Arbitration & ADR',
    subAreas: [
      {
        slug: 'arbitration',
        label: 'Arbitration',
        forums: ['arbitral_tribunal', 'high_court'],
        remedies: ['arbitral_award', 'interim_relief'],
        documentTypes: ['arbitration_petition', 'statement_of_claim'],
        curatedKinds: [
          'india_arbitration_notice_s21',
          'india_s11_arbitrator_appointment',
        ],
      },
    ],
  },
  {
    slug: 'insolvency',
    label: 'Insolvency',
    subAreas: [
      {
        slug: 'cirp',
        label: 'CIRP',
        forums: ['nclt'],
        remedies: ['resolution', 'liquidation'],
        documentTypes: ['cirp_application', 'claim'],
        curatedKinds: ['india_ibc_cirp_application'],
      },
    ],
  },
  {
    slug: 'tax',
    label: 'Tax',
    subAreas: [
      {
        slug: 'assessment_appeal',
        label: 'Assessment & Appeal',
        forums: ['itat', 'high_court'],
        remedies: ['appeal', 'stay'],
        documentTypes: ['tax_appeal', 'reply_to_notice'],
        curatedKinds: ['india_tax_appeal_itat'],
      },
    ],
  },
];

export function findPracticeArea(slug: string): PracticeAreaDefinition | undefined {
  return MATTER_TAXONOMY.find((p) => p.slug === slug);
}

export function findSubPractice(
  practiceArea: string,
  subSlug: string,
): SubPracticeDefinition | undefined {
  return findPracticeArea(practiceArea)?.subAreas.find((s) => s.slug === subSlug);
}

export function allPracticeAreaSlugs(): string[] {
  return MATTER_TAXONOMY.map((p) => p.slug);
}

export function resolvePracticeAreaAliases(slugOrAlias: string): string {
  const normalized = slugOrAlias.toLowerCase().replace(/\s+/g, '_');
  const direct = MATTER_TAXONOMY.find((p) => p.slug === normalized);
  if (direct) return direct.slug;
  const aliasMap: Record<string, string> = {
    employment: 'employment_labour',
    labour: 'employment_labour',
    labor: 'employment_labour',
    family: 'family_matrimonial',
    matrimonial: 'family_matrimonial',
    property: 'real_estate_property',
    real_estate: 'real_estate_property',
    corporate: 'corporate_commercial',
    commercial: 'corporate_commercial',
    criminal: 'litigation_disputes',
    litigation: 'litigation_disputes',
    adr: 'arbitration_adr',
    arbitration: 'arbitration_adr',
  };
  return aliasMap[normalized] ?? normalized;
}
