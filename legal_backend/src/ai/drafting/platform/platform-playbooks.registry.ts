/**
 * Versioned DraftPlaybook definitions for Wave 1 document kinds.
 * Migrates / extends legacy DraftKindPlaybook thresholds.
 */

import type { DraftPlaybook } from '../contracts/draft-playbook';
import { KENYA_DRAFT_CATALOG } from '@/config/templates/kenya-drafting-catalog';

const BAIL_MANDATORY = [
  { id: 'applicantName', label: 'Applicant name', path: 'parties', blocking: true },
  { id: 'firDate', label: 'FIR date', path: 'matterData.firDetails.firDate', blocking: true },
  { id: 'custodyStatus', label: 'Custody status', path: 'matterData.custodyStatus', blocking: true },
  { id: 'chargedSections', label: 'Charged sections', path: 'statutes', blocking: true },
  { id: 'proceduralStage', label: 'Procedural stage', path: 'matterData.proceduralStage', blocking: true },
  { id: 'courtName', label: 'Court', path: 'jurisdiction.courtName', blocking: false },
  { id: 'firNo', label: 'FIR number', path: 'matterData.firDetails.firNo', blocking: false },
  { id: 'policeStation', label: 'Police station', path: 'matterData.firDetails.policeStation', blocking: false },
];

const BAIL_SECTIONS = [
  { id: 'cause_title', title: 'CAUSE TITLE', required: true },
  { id: 'facts', title: 'FACTS', required: true, minClaims: 3 },
  { id: 'grounds', title: 'GROUNDS', required: true, minClaims: 2 },
  { id: 'prayer', title: 'PRAYER', required: true },
  { id: 'verification', title: 'VERIFICATION', required: true },
];

const BAIL_ISSUES = [
  { id: 'bail_is_rule', label: 'Bail is the rule', required: true },
  { id: 'bail_factors', label: 'Statutory bail factors', required: true },
  { id: 'fact_anchored_defence', label: 'Fact-anchored defence', required: true, factCategories: ['defence'] },
  { id: 'parity_if_applicable', label: 'Parity with co-accused', required: false, factCategories: ['parity'] },
];

const BAIL_RELEASE = [
  { id: 'custody_consistency', description: 'Custody status matches prayer', severity: 'blocker' as const, checkKey: 'bail.custody' },
  { id: 'post_chargesheet_language', description: 'No investigation-pending after chargesheet', severity: 'blocker' as const, checkKey: 'bail.post_chargesheet' },
  { id: 'charge_reproduction', description: 'Charged sections reproduced exactly', severity: 'blocker' as const, checkKey: 'bail.charges' },
  { id: 'party_label', description: 'Uses Applicant–Accused', severity: 'warning' as const, checkKey: 'bail.party_label' },
];

function regularBailPlaybook(documentKind: string): DraftPlaybook {
  return {
    id: `playbook:${documentKind}:v1`,
    jurisdiction: 'IN',
    documentKind,
    version: '1.0.0',
    active: true,
    filingGrade: true,
    lawyerApproved: true,
    minEvalPassRate: 0.95,
    goldExampleIds: ['in-bail-rohan-mehta-cyber-fraud'],
    supportedCourts: ['sessions', 'high_court', 'magistrate'],
    supportedProceduralStages: ['investigation', 'post_chargesheet', 'trial'],
    mandatoryFields: BAIL_MANDATORY,
    optionalFields: [
      { id: 'antecedents', label: 'Antecedents', path: 'matterData.antecedents', blocking: false },
    ],
    requiredSections: BAIL_SECTIONS,
    optionalSections: [],
    issueTaxonomy: BAIL_ISSUES,
    requiredFactCategories: [
      { category: 'defence', required: true, materialityDefault: 'critical' },
      { category: 'procedural', required: true, materialityDefault: 'critical' },
      { category: 'parity', required: false, materialityDefault: 'important' },
    ],
    planningMode: 'remedy_based',
    statuteRules: [
      { id: 'bnss_480', actId: 'BNSS', sections: ['480'], role: 'procedural_vehicle', required: true },
      { id: 'bnss_483', actId: 'BNSS', sections: ['483'], role: 'procedural_vehicle', required: false },
    ],
    remedyRules: [
      {
        id: 'regular_bail',
        label: 'Regular bail',
        allowedPrayerPatterns: ['enlarge.*on bail', 'regular bail', 'bail under'],
        prohibitedPrayerPatterns: ['anticipatory bail', 'pre-arrest'],
      },
    ],
    adverseFactRules: [
      {
        id: 'intimidation',
        description: 'Intimidation allegations must be addressed cautiously',
        dispositionDefault: 'address_adverse_fact',
      },
    ],
    prayerRules: [
      {
        id: 'bail_prayer',
        requiredElements: ['bail'],
        prohibitedElements: ['anticipatory'],
      },
    ],
    verificationRules: [{ id: 'verification', required: true }],
    releaseChecks: BAIL_RELEASE,
    partyLabel: 'Applicant–Accused',
    minCitationsPerGround: 1,
    minVerifiedCaseAuthorities: 3,
    factCoverageThreshold: 0.85,
  };
}

function anticipatoryBailPlaybook(documentKind: string): DraftPlaybook {
  const base = regularBailPlaybook(documentKind);
  return {
    ...base,
    id: `playbook:${documentKind}:v1`,
    documentKind,
    supportedProceduralStages: ['pre_fir', 'investigation'],
    issueTaxonomy: [
      { id: 'anticipatory_bail', label: 'Anticipatory bail maintainability', required: true },
      { id: 'arrest_necessity', label: 'No necessity of custodial interrogation', required: true },
      { id: 'bail_factors', label: 'Statutory bail factors', required: true },
    ],
    statuteRules: [
      { id: 'bnss_482', actId: 'BNSS', sections: ['482'], role: 'procedural_vehicle', required: true },
    ],
    remedyRules: [
      {
        id: 'anticipatory_bail',
        label: 'Anticipatory bail',
        allowedPrayerPatterns: ['anticipatory bail', 'pre-arrest', 'protection from arrest'],
        prohibitedPrayerPatterns: ['enlarge.*on bail', 'regular bail'],
      },
    ],
    releaseChecks: [
      ...BAIL_RELEASE.filter((c) => c.id !== 'custody_consistency'),
      {
        id: 'not_in_custody',
        description: 'Applicant must not already be in custody',
        severity: 'blocker',
        checkKey: 'anticipatory.not_in_custody',
      },
      {
        id: 'no_regular_bail_prayer',
        description: 'Must not use regular-bail prayer',
        severity: 'blocker',
        checkKey: 'anticipatory.no_regular_prayer',
      },
    ],
    partyLabel: 'Applicant',
  };
}

function legalNoticePlaybook(): DraftPlaybook {
  return {
    id: 'playbook:india_legal_notice_general:v1',
    jurisdiction: 'IN',
    documentKind: 'india_legal_notice_general',
    version: '1.0.0',
    active: true,
    filingGrade: false,
    lawyerApproved: true,
    minEvalPassRate: 0.8,
    supportedCourts: [],
    supportedProceduralStages: [],
    mandatoryFields: [
      { id: 'senderName', label: 'Sender', path: 'matterData.senderName', blocking: true },
      { id: 'recipientName', label: 'Recipient', path: 'matterData.recipientName', blocking: true },
      { id: 'demandAmount', label: 'Demand amount', path: 'matterData.demandAmount', blocking: false },
      { id: 'demandBasis', label: 'Basis of demand', path: 'matterData.demandBasis', blocking: true },
      { id: 'curePeriod', label: 'Cure period', path: 'matterData.curePeriod', blocking: false },
    ],
    optionalFields: [],
    requiredSections: [
      { id: 'heading', title: 'LEGAL NOTICE', required: true },
      { id: 'facts', title: 'FACTS', required: true },
      { id: 'demand', title: 'DEMAND', required: true },
      { id: 'consequences', title: 'CONSEQUENCES', required: true },
    ],
    optionalSections: [],
    issueTaxonomy: [
      { id: 'demand_consistency', label: 'Demand consistency', required: true },
      ],
    requiredFactCategories: [
      { category: 'transaction', required: true, materialityDefault: 'critical' },
    ],
    planningMode: 'remedy_based',
    statuteRules: [],
    remedyRules: [
      {
        id: 'civil_demand',
        label: 'Civil demand',
        allowedPrayerPatterns: ['pay', 'comply', 'cure'],
        prohibitedPrayerPatterns: ['arrest', 'criminal prosecution without basis'],
      },
    ],
    adverseFactRules: [],
    prayerRules: [{ id: 'demand', requiredElements: ['demand'] }],
    verificationRules: [],
    releaseChecks: [
      {
        id: 'demand_supported',
        description: 'Demand amount and basis supported by Case Record',
        severity: 'blocker',
        checkKey: 'notice.demand',
      },
      {
        id: 'no_unlawful_threat',
        description: 'No threats beyond lawful remedies',
        severity: 'blocker',
        checkKey: 'notice.threats',
      },
    ],
    partyLabel: 'Sender',
    minCitationsPerGround: 0,
    minVerifiedCaseAuthorities: 0,
    factCoverageThreshold: 0.7,
  };
}

function serviceAgreementPlaybook(): DraftPlaybook {
  return {
    id: 'playbook:service_agreement_general:v1',
    jurisdiction: 'IN',
    documentKind: 'service_agreement_general',
    version: '1.0.0',
    active: true,
    filingGrade: false,
    lawyerApproved: true,
    minEvalPassRate: 0.8,
    supportedCourts: [],
    supportedProceduralStages: [],
    mandatoryFields: [
      { id: 'parties', label: 'Contracting parties', path: 'parties', blocking: true },
      { id: 'transactionType', label: 'Transaction type', path: 'matterData.transactionType', blocking: true },
    ],
    optionalFields: [
      { id: 'governingLaw', label: 'Governing law', path: 'matterData.governingLawPreference', blocking: false },
    ],
    requiredSections: [
      { id: 'parties', title: 'PARTIES', required: true },
      { id: 'services', title: 'SERVICES', required: true },
      { id: 'payment', title: 'PAYMENT', required: true },
      { id: 'term', title: 'TERM AND TERMINATION', required: true },
      { id: 'governing_law', title: 'GOVERNING LAW', required: true },
    ],
    optionalSections: [
      { id: 'ip', title: 'INTELLECTUAL PROPERTY', required: false },
      { id: 'confidentiality', title: 'CONFIDENTIALITY', required: false },
    ],
    issueTaxonomy: [
      { id: 'commercial_terms', label: 'Commercial terms consistency', required: true },
    ],
    requiredFactCategories: [
      { category: 'commercial', required: true, materialityDefault: 'critical' },
    ],
    planningMode: 'contract_term',
    statuteRules: [],
    remedyRules: [],
    adverseFactRules: [],
    prayerRules: [],
    verificationRules: [],
    releaseChecks: [
      {
        id: 'term_consistency',
        description: 'No conflicting payment / IP / termination / dispute clauses',
        severity: 'blocker',
        checkKey: 'contract.term_consistency',
      },
      {
        id: 'no_criminal_fields',
        description: 'Contract Case Record must not require FIR/arrest fields',
        severity: 'blocker',
        checkKey: 'contract.no_criminal_fields',
      },
    ],
    partyLabel: 'Party',
    minCitationsPerGround: 0,
    minVerifiedCaseAuthorities: 0,
    factCoverageThreshold: 0.6,
  };
}

function consumerComplaintPlaybook(documentKind: string): DraftPlaybook {
  return {
    id: `playbook:${documentKind}:v1`,
    jurisdiction: 'IN',
    documentKind,
    version: '1.0.0',
    active: true,
    filingGrade: true,
    lawyerApproved: true,
    minEvalPassRate: 0.95,
    supportedCourts: ['district_consumer', 'state_consumer', 'national_consumer'],
    supportedProceduralStages: ['pre_filing', 'complaint'],
    mandatoryFields: [
      { id: 'complainant', label: 'Complainant', path: 'parties', blocking: true },
      { id: 'opposite_parties', label: 'Opposite Parties', path: 'parties', blocking: true },
      { id: 'jurisdiction', label: 'Forum / jurisdiction', path: 'jurisdiction.courtName', blocking: true },
    ],
    optionalFields: [
      { id: 'insurer', label: 'Insurer facts', path: 'facts', blocking: false },
    ],
    requiredSections: [
      { id: 'cause_title', title: 'CAUSE TITLE', required: true },
      { id: 'memo', title: 'MEMO OF PARTIES', required: true },
      { id: 'facts', title: 'FACTS', required: true, minClaims: 3 },
      { id: 'jurisdiction', title: 'JURISDICTION', required: true },
      { id: 'grounds', title: 'GROUNDS', required: true, minClaims: 2 },
      { id: 'prayer', title: 'PRAYER', required: true },
      { id: 'verification', title: 'VERIFICATION', required: true },
    ],
    optionalSections: [],
    issueTaxonomy: [
      { id: 'deficiency_in_service', label: 'Deficiency in service', required: true },
      { id: 'jurisdiction', label: 'Jurisdiction', required: true },
      { id: 'medical_negligence_allegation', label: 'Medical negligence (alleged)', required: false },
    ],
    requiredFactCategories: [
      { category: 'parties', required: true, materialityDefault: 'critical' },
      { category: 'chronology', required: true, materialityDefault: 'critical' },
      { category: 'jurisdiction', required: true, materialityDefault: 'critical' },
    ],
    planningMode: 'cause_of_action',
    statuteRules: [
      { id: 'cpa_35', actId: 'CPA', sections: ['35'], role: 'procedural_vehicle', required: true },
      { id: 'cpa_34', actId: 'CPA', sections: ['34'], role: 'procedural_vehicle', required: false },
    ],
    remedyRules: [
      {
        id: 'consumer_relief',
        label: 'Consumer compensation / directions',
        allowedPrayerPatterns: ['compensation', 'deficiency', 'production', 'costs'],
        prohibitedPrayerPatterns: [],
      },
    ],
    adverseFactRules: [
      {
        id: 'recognised_complication',
        description: 'Recognised medical complication vs negligent technique',
        dispositionDefault: 'address_adverse_fact',
      },
    ],
    prayerRules: [
      {
        id: 'consumer_prayer',
        requiredElements: ['compensation'],
        prohibitedElements: [],
      },
    ],
    verificationRules: [{ id: 'verification', required: true }],
    releaseChecks: [
      {
        id: 'no_invented_insurer_denial',
        description: 'No invented insurer repudiation',
        severity: 'blocker',
        checkKey: 'INVENTED_INSURER_DENIAL',
      },
      {
        id: 'party_terminology',
        description: 'Uses Complainant / Opposite Party',
        severity: 'warning',
        checkKey: 'WRONG_PARTY_TERMINOLOGY',
      },
    ],
    partyLabel: 'Complainant',
    minCitationsPerGround: 1,
    minVerifiedCaseAuthorities: 2,
    factCoverageThreshold: 0.85,
  };
}

function consumerInterimPlaybook(documentKind: string): DraftPlaybook {
  const base = consumerComplaintPlaybook(documentKind);
  return {
    ...base,
    id: `playbook:${documentKind}:v1`,
    documentKind,
    requiredSections: [
      { id: 'cause_title', title: 'CAUSE TITLE', required: true },
      { id: 'facts', title: 'FACTS', required: true },
      { id: 'grounds', title: 'GROUNDS', required: true },
      { id: 'prayer', title: 'PRAYER', required: true },
      { id: 'verification', title: 'VERIFICATION', required: true },
    ],
    issueTaxonomy: [
      { id: 'preservation', label: 'Records preservation', required: true },
      { id: 'production', label: 'Document production', required: true },
    ],
    factCoverageThreshold: 0.75,
  };
}

function researchMemoPlaybook(documentKind: string): DraftPlaybook {
  const isConsumer = /consumer/i.test(documentKind);
  return {
    id: `playbook:${documentKind}:v1`,
    jurisdiction: 'IN',
    documentKind,
    version: '1.0.0',
    active: true,
    filingGrade: false,
    lawyerApproved: true,
    minEvalPassRate: 0.8,
    supportedCourts: [],
    supportedProceduralStages: ['pre_filing', 'research'],
    mandatoryFields: [
      { id: 'parties', label: 'Parties / client', path: 'parties', blocking: true },
      { id: 'facts', label: 'Case facts', path: 'facts', blocking: true },
    ],
    optionalFields: [
      { id: 'court', label: 'Forum / court', path: 'jurisdiction.courtName', blocking: false },
    ],
    requiredSections: [
      { id: 'short_answer', title: 'SHORT ANSWER', required: true },
      { id: 'issues', title: 'ISSUES', required: true },
      { id: 'facts', title: 'FACTS', required: true },
      { id: 'analysis', title: 'ANALYSIS', required: true },
      { id: 'authorities', title: 'AUTHORITIES', required: true },
      { id: 'next_steps', title: 'NEXT STEPS', required: true },
    ],
    optionalSections: [],
    issueTaxonomy: [
      { id: 'legal_issues', label: 'Framed legal issues', required: true },
      { id: 'adverse_authorities', label: 'Adverse authorities', required: isConsumer },
    ],
    requiredFactCategories: [
      { category: 'parties', required: true, materialityDefault: 'critical' },
      { category: 'chronology', required: false, materialityDefault: 'important' },
    ],
    planningMode: 'legal_issue',
    statuteRules: [],
    remedyRules: [],
    adverseFactRules: [],
    prayerRules: [],
    verificationRules: [],
    releaseChecks: [
      {
        id: 'no_pleading_form',
        description: 'Must not be drafted as a court pleading (no CAUSE TITLE / PRAYER / VERIFICATION)',
        severity: 'warning',
        checkKey: 'research.no_pleading_form',
      },
      ...(isConsumer
        ? [
            {
              id: 'no_invented_insurer_denial',
              description: 'No invented insurer repudiation or vicarious insurer liability',
              severity: 'blocker' as const,
              checkKey: 'INVENTED_INSURER_DENIAL',
            },
          ]
        : []),
    ],
    partyLabel: 'Client',
    minCitationsPerGround: 0,
    minVerifiedCaseAuthorities: 2,
    factCoverageThreshold: 0.6,
  };
}

function caseStrategyPlaybook(documentKind: string): DraftPlaybook {
  const base = researchMemoPlaybook(documentKind);
  return {
    ...base,
    id: `playbook:${documentKind}:v1`,
    documentKind,
    requiredSections: [
      { id: 'thesis', title: 'CASE THESIS', required: true },
      { id: 'parties', title: 'PARTY ANALYSIS', required: true },
      { id: 'issues', title: 'ISSUES', required: true },
      { id: 'authorities', title: 'AUTHORITIES', required: true },
      { id: 'evidence', title: 'EVIDENCE PLAN', required: true },
      { id: 'next_steps', title: 'NEXT STEPS', required: true },
    ],
    partyLabel: 'Client',
    factCoverageThreshold: 0.65,
  };
}

function kenyaPendingReviewPlaybook(
  catalogEntry: (typeof KENYA_DRAFT_CATALOG)[number],
): DraftPlaybook {
  const isFiling = catalogEntry.kind !== 'kenya_demand_letter';
  const requiredSections = isFiling
    ? [
        { id: 'heading', title: 'COURT AND PARTIES', required: true },
        { id: 'facts', title: 'FACTS', required: true },
        { id: 'legal_basis', title: 'LEGAL BASIS', required: true },
        { id: 'relief', title: 'RELIEF SOUGHT', required: true },
      ]
    : [
        { id: 'facts', title: 'BACKGROUND', required: true },
        { id: 'demand', title: 'DEMAND', required: true },
        { id: 'legal_basis', title: 'LEGAL BASIS', required: true },
      ];

  const requiredAuthorityFields = catalogEntry.requiredAuthorityFields.map((field) => ({
    id: field.id,
    label: field.label,
    path: `matterData.authority.${field.id}`,
    blocking: field.required,
    description: field.description,
  }));

  return {
    id: `playbook:${catalogEntry.kind}:pending-review-v1`,
    jurisdiction: 'KE',
    documentKind: catalogEntry.kind,
    version: '0.1.0',
    active: true,
    filingGrade: false,
    lawyerApproved: false,
    advocateReview: catalogEntry.advocateReview,
    requiredAuthorityFields,
    supportedCourts: [],
    supportedProceduralStages: isFiling ? ['pre_filing', 'filing'] : ['pre_filing'],
    mandatoryFields: requiredAuthorityFields,
    optionalFields: [],
    requiredSections,
    optionalSections: [],
    issueTaxonomy: [
      {
        id: 'kenyan_legal_basis',
        label: 'Applicable Kenyan legal and procedural authority',
        required: true,
        authorities: ['Kenya Law', 'applicable Acts of Parliament', 'applicable court rules'],
      },
    ],
    requiredFactCategories: [
      { category: 'parties', required: true, materialityDefault: 'critical' },
      { category: 'chronology', required: true, materialityDefault: 'critical' },
      { category: 'jurisdiction', required: isFiling, materialityDefault: 'critical' },
    ],
    planningMode: isFiling ? 'cause_of_action' : 'remedy_based',
    statuteRules: [],
    remedyRules: [],
    adverseFactRules: [],
    prayerRules: [],
    verificationRules: [{ id: 'kenya_authority_and_filing_review', required: true }],
    releaseChecks: [
      {
        id: 'kenya_advocate_review_pending',
        description: 'Kenya template has not yet completed advocate review',
        severity: 'warning',
        checkKey: 'kenya.advocate_review',
      },
      {
        id: 'kenya_authorities_current',
        description: 'Cited Kenyan authorities and filing requirements must be verified',
        severity: 'blocker',
        checkKey: 'kenya.authority_verification',
      },
    ],
    partyLabel: isFiling ? 'Claimant / Applicant' : 'Sender',
    minCitationsPerGround: isFiling ? 1 : 0,
    minVerifiedCaseAuthorities: 0,
    factCoverageThreshold: 0.75,
  };
}

/** Canonical Wave-1 + migrated bail playbooks. */
export const PLATFORM_DRAFT_PLAYBOOKS: DraftPlaybook[] = [
  regularBailPlaybook('india_regular_bail_bnss_480'),
  regularBailPlaybook('india_bail_application'),
  anticipatoryBailPlaybook('india_anticipatory_bail_bnss_482'),
  anticipatoryBailPlaybook('india_anticipatory_bail'),
  legalNoticePlaybook(),
  serviceAgreementPlaybook(),
  consumerComplaintPlaybook('india_consumer_complaint'),
  consumerComplaintPlaybook('india_consumer_medical_negligence'),
  consumerInterimPlaybook('india_interim_application_document_production'),
  consumerInterimPlaybook('india_consumer_interim_records_preservation'),
  researchMemoPlaybook('india_legal_research_memo'),
  researchMemoPlaybook('india_consumer_research_memo'),
  caseStrategyPlaybook('india_case_strategy_memo'),
  ...KENYA_DRAFT_CATALOG.map(kenyaPendingReviewPlaybook),
];

export const PLAYBOOK_KIND_ALIASES: Record<string, string> = {
  india_regular_bail_bnss_480: 'india_regular_bail_bnss_480',
  india_bail_application: 'india_bail_application',
  india_anticipatory_bail_bnss_482: 'india_anticipatory_bail_bnss_482',
  india_anticipatory_bail: 'india_anticipatory_bail',
  india_legal_notice: 'india_legal_notice_general',
  india_legal_notice_general: 'india_legal_notice_general',
  service_agreement: 'service_agreement_general',
  service_agreement_general: 'service_agreement_general',
  india_consumer_complaint: 'india_consumer_complaint',
  india_consumer_medical_negligence: 'india_consumer_medical_negligence',
  india_interim_application_document_production: 'india_interim_application_document_production',
  india_consumer_interim_records_preservation: 'india_consumer_interim_records_preservation',
  india_legal_research_memo: 'india_legal_research_memo',
  india_consumer_research_memo: 'india_consumer_research_memo',
  india_case_strategy_memo: 'india_case_strategy_memo',
};
