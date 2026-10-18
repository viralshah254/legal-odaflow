import { EXTENDED_DOCUMENT_KINDS } from './extended-kinds';

/** Original 40 canonical document kinds. */
const BASE_DOCUMENT_KINDS = [
  'engagement_letter',
  'service_agreement',
  'nda',
  'partnership_agreement',
  'lease_agreement',
  'employment_contract',
  'shareholders_agreement',
  'board_resolution',
  'demand_letter',
  'settlement_agreement',
  'grievance_letter',
  'intake_letter',
  'consumer_complaint',
  'civil_plaint',
  'consent_order',
  'parenting_plan',
  'protective_injunction',
  'sale_agreement',
  'title_opinion',
  'bail_application',
  'defense_memo',
  'discharge_application',
  'plea_in_mitigation',
  'police_complaint',
  'cover_letter',
  'appeal_letter',
  'sponsor_letter',
  'document_checklist',
  'ip_assignment',
  'licensing_agreement',
  'cease_desist',
  'witness_statement',
  'mediation_brief',
  'representation_letter',
  'appeal_grounds',
  'tax_advice_memo',
  'voluntary_disclosure',
  'last_will_testament',
  'power_of_attorney',
  'estate_accounts',
  'inheritance_trust_deed',
  'llc_operating_agreement',
  'incorporation_documents',
] as const;

/** Canonical document kinds — base + extended (~120 total). */
export const ALL_DOCUMENT_KINDS = [
  ...BASE_DOCUMENT_KINDS,
  ...EXTENDED_DOCUMENT_KINDS,
] as const;

export type DocumentKind = (typeof ALL_DOCUMENT_KINDS)[number];

/** Maps intake / preview documentType synonyms to canonical documentKind. */
export const DOCUMENT_TYPE_TO_TEMPLATE_KIND: Record<string, string> = {
  contract: 'service_agreement',
  software_contractor_agreement: 'service_agreement',
  service_agreement: 'service_agreement',
  contractor_agreement: 'service_agreement',
  contractor: 'service_agreement',
  service_contract: 'service_agreement',
  job_contract: 'employment_contract',
  job_offer: 'offer_letter',
  construction_contract: 'construction_contract',
  construction_agreement: 'construction_contract',
  building_contract: 'construction_contract',
  subcontractor: 'construction_contract',
  subcontractor_agreement: 'construction_contract',
  freelancer: 'service_agreement',
  freelance_agreement: 'service_agreement',
  consulting_agreement: 'service_agreement',
  consultancy_agreement: 'service_agreement',
  mutual_nda: 'nda',
  one_way_nda: 'nda',
  unilateral_nda: 'nda',
  master_service_agreement: 'master_service_agreement',
  nda: 'nda',
  non_disclosure: 'nda',
  employment: 'employment_contract',
  employment_contract: 'employment_contract',
  offer_letter: 'offer_letter',
  lease: 'lease_agreement',
  lease_agreement: 'lease_agreement',
  residential_lease: 'residential_lease',
  commercial_lease: 'commercial_lease',
  partnership_agreement: 'partnership_agreement',
  partnership: 'partnership_agreement',
  will: 'last_will_testament',
  last_will_testament: 'last_will_testament',
  demand_letter: 'demand_letter',
  demand: 'demand_letter',
  settlement_agreement: 'settlement_agreement',
  settlement: 'settlement_agreement',
  sale_agreement: 'sale_agreement',
  engagement_letter: 'engagement_letter',
  shareholders_agreement: 'shareholders_agreement',
  board_resolution: 'board_resolution',
  grievance_letter: 'grievance_letter',
  intake_letter: 'intake_letter',
  consent_order: 'consent_order',
  parenting_plan: 'parenting_plan',
  protective_injunction: 'protective_injunction',
  title_opinion: 'title_opinion',
  bail_application: 'bail_application',
  defense_memo: 'defense_memo',
  discharge_application: 'discharge_application',
  plea_in_mitigation: 'plea_in_mitigation',
  police_complaint: 'police_complaint',
  cover_letter: 'cover_letter',
  appeal_letter: 'appeal_letter',
  sponsor_letter: 'sponsor_letter',
  document_checklist: 'document_checklist',
  ip_assignment: 'ip_assignment',
  licensing_agreement: 'licensing_agreement',
  cease_desist: 'cease_desist',
  witness_statement: 'witness_statement',
  mediation_brief: 'mediation_brief',
  representation_letter: 'representation_letter',
  appeal_grounds: 'appeal_grounds',
  tax_advice_memo: 'tax_advice_memo',
  voluntary_disclosure: 'voluntary_disclosure',
  power_of_attorney: 'power_of_attorney',
  estate_accounts: 'estate_accounts',
  inheritance_trust_deed: 'inheritance_trust_deed',
  llc_operating_agreement: 'llc_operating_agreement',
  incorporation_documents: 'incorporation_documents',
  prenup: 'prenuptial_agreement',
  prenuptial_agreement: 'prenuptial_agreement',
  postnuptial_agreement: 'postnuptial_agreement',
  divorce: 'divorce_petition',
  spa: 'share_purchase_agreement',
  share_purchase_agreement: 'share_purchase_agreement',
  apa: 'asset_purchase_agreement',
  asset_purchase_agreement: 'asset_purchase_agreement',
  jv: 'joint_venture_agreement',
  joint_venture_agreement: 'joint_venture_agreement',
  franchise: 'franchise_agreement',
  franchise_agreement: 'franchise_agreement',
  dpa: 'data_processing_agreement',
  data_processing_agreement: 'data_processing_agreement',
  loan: 'loan_agreement',
  loan_agreement: 'loan_agreement',
  mortgage: 'mortgage_deed',
  mortgage_deed: 'mortgage_deed',
  particulars_of_claim: 'particulars_of_claim',
  affidavit: 'affidavit',
  trademark_assignment: 'trademark_assignment',
  software_licence: 'software_licence',
  probate: 'grant_of_probate_application',
  codicil: 'codicil',
  termination_letter: 'termination_letter',
  redundancy_letter: 'redundancy_letter',
  tax_registration: 'tax_registration_application',
  objection_to_assessment: 'objection_to_assessment',
  articles_of_association: 'articles_of_association',
  memorandum_of_association: 'memorandum_of_association',
  llp_deed: 'llp_deed',
  privacy_policy: 'privacy_policy',
  terms_of_service: 'terms_of_service',
};

export function resolveDocumentKind(
  documentType: string | undefined,
  factsSummary?: string,
  planningAnswers?: Record<string, string>,
  matterTitle?: string,
): string {
  const normalized = (documentType ?? '').toLowerCase().trim();

  const haystack = [
    matterTitle ?? '',
    factsSummary ?? '',
    planningAnswers?.scopeOfWork ?? '',
    planningAnswers?.documentType ?? '',
    Object.values(planningAnswers ?? {}).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  // Check the explicit map first, but only when the title doesn't contradict it.
  // e.g. workspace.documentType='nda' must not win over a title saying "Contractor Agreement".
  if (DOCUMENT_TYPE_TO_TEMPLATE_KIND[normalized]) {
    const mapped = DOCUMENT_TYPE_TO_TEMPLATE_KIND[normalized];
    const titleOverridesNda =
      mapped === 'nda' &&
      /contractor|service agreement|freelance|consultancy|software development/i.test(
        matterTitle ?? '',
      );
    if (!titleOverridesNda) {
      return mapped;
    }
  }

  // Check contractor/service before employment so "not an employment but contractor" resolves correctly.
  if (/\bcontractor\b(?!\s+(for\s+build|construction|renovation))|independent contractor|freelancer|freelance|consultant agreement|consultancy/i.test(haystack)) {
    return 'service_agreement';
  }
  if (/construction|building works|subcontractor|contractor for build|renovation contract/i.test(haystack)) {
    return 'construction_contract';
  }

  // India court pleadings — before employment/contract heuristics so incidental
  // "employed at Infosys" in a maintenance revision narrative does not win.
  const indiaFilingKind = resolveIndiaCourtPleadingKind(haystack);
  if (indiaFilingKind) {
    return indiaFilingKind;
  }

  if (
    /wrongful|illegal\s+termination|terminated\s+without|reinstatement|back\s+wages|loss\s+of\s+confidence|labour\s+court|workman|industrial\s+dispute/i.test(
      haystack,
    ) &&
    /employ|termination|workman|salary|job|dismissed|fired/i.test(haystack)
  ) {
    return 'wrongful_termination_petition';
  }

  if (/employment|employee|salary|job title|probation|ctc|offer letter|job contract/i.test(haystack)) {
    return 'employment_contract';
  }
  if (/prenup|postnup|marital agreement|before marriage/i.test(haystack)) {
    return 'prenuptial_agreement';
  }
  if (
    /divorce|dissolution\s+of\s+marriage|judicial\s+sep(aration)?|petition\s+(for|of)\s+(divorce|dissolution|separation)/i.test(
      haystack,
    )
  ) {
    if (/judicial\s+sep(aration)?/i.test(haystack)) return 'judicial_separation';
    return 'divorce_petition';
  }
  if (/separation\s+agreement/i.test(haystack)) {
    return 'divorce_petition';
  }
  if (/restitution\s+of\s+conjugal\s+rights|section\s+9\s+(of\s+)?hma/i.test(haystack)) {
    return 'restitution_conjugal_rights';
  }
  if (/share purchase|spa|acquisition of shares/i.test(haystack)) {
    return 'share_purchase_agreement';
  }
  if (/asset purchase|business sale/i.test(haystack)) {
    return 'asset_purchase_agreement';
  }
  if (/mortgage|charge over property/i.test(haystack)) {
    return 'mortgage_deed';
  }
  if (/residential lease|tenancy agreement|rent/i.test(haystack)) {
    return /commercial/i.test(haystack) ? 'commercial_lease' : 'residential_lease';
  }
  if (/service agreement|scope of work/i.test(haystack)) {
    return 'service_agreement';
  }
  if (/non.?disclosure|nda|confidentiality agreement/i.test(haystack)) {
    return 'nda';
  }
  if (/lease|tenancy|landlord|tenant/i.test(haystack)) {
    return 'lease_agreement';
  }
  if (/partnership|partership|partner agreement|equity split/i.test(haystack)) {
    return 'partnership_agreement';
  }
  if (/will|testament|executor|beneficiary/i.test(haystack)) {
    return 'last_will_testament';
  }
  if (/demand letter|pre.?litigation/i.test(haystack)) {
    return 'demand_letter';
  }
  if (/incorporat|company formation|llc/i.test(haystack)) {
    return /llc|limited liability/i.test(haystack) ? 'llc_operating_agreement' : 'incorporation_documents';
  }
  if (/tax registration|gst|vat registration/i.test(haystack)) {
    return 'tax_registration_application';
  }
  if (/probate|letters of administration/i.test(haystack)) {
    return 'grant_of_probate_application';
  }
  if (
    /domestic violence|protective order|non.?molestation|restraining order|non molestation|abuse by (my )?(husband|wife|partner)|attacked by (my )?(husband|wife|partner)|harm and domestic/i.test(
      haystack,
    )
  ) {
    return 'protective_injunction';
  }
  if (/police complaint|\bfir\b|criminal complaint|first information report/i.test(haystack)) {
    return 'police_complaint';
  }
  // Generic filing-intent: stalking, harassment (non-workplace/non-DV), or explicit "file/lodge a complaint"
  if (
    /\bstalking?\b|\bcyberstalking?\b/i.test(haystack) ||
    /\b(file|lodge|wants? to file|wants? to lodge)\s+(a\s+)?complaint\b/i.test(haystack) ||
    /\bcomplaint against\b/i.test(haystack)
  ) {
    return 'police_complaint';
  }

  return 'service_agreement';
}

/**
 * Returns true when the text is primarily about a matrimonial-dissolution remedy
 * (divorce, judicial separation, restitution of conjugal rights) — even if it also
 * mentions maintenance/alimony as ancillary relief.  Used to prevent the
 * maintenance branch from hijacking divorce petitions.
 */
export function hasPrimaryMatrimonialReliefContext(text: string): boolean {
  const lower = text.toLowerCase();
  // Explicit divorce or dissolution keywords
  const hasDivorceIntent =
    /\b(divorce|dissolution\s+of\s+marriage|judicial\s+sep(aration)?|section\s+13\s+(of\s+)?(the\s+)?hma|hma\s+(sec(tion)?\.?\s*)?13\b|section\s+10\s+(of\s+)?(the\s+)?hma|petition\s+(for|of)\s+(divorce|dissolution|separation)|decree\s+of\s+divorce|seeks?\s+divorce|filed.{0,30}divorce|grounds?\s+of\s+(cruelty|desertion|adultery)|mental\s+cruelty.{0,60}(divorce|decree|marriage)|desertion.{0,60}(divorce|decree|marriage))\b/i.test(
      lower,
    );
  // Restitution
  const hasRestitutionIntent = /\b(restitution\s+of\s+conjugal\s+rights|section\s+9\s+(of\s+)?hma)\b/i.test(lower);

  if (!hasDivorceIntent && !hasRestitutionIntent) return false;

  // Maintenance/alimony must NOT appear as a standalone primary ask
  // (i.e. no existing order to challenge and no revision/appeal language)
  const hasMaintenanceOrderChallenge =
    /\b(interim\s+maintenance\s+order|interim\s+order.{0,30}maintenance|maintenance\s+order.{0,30}(revision|challenge|set aside|appeal)|revision.{0,30}maintenance\s+order|against.{0,30}maintenance\s+order|set\s+aside.{0,30}maintenance|crpc\s*§?\s*125|bnss\s*§?\s*144|bnss\s+144|section\s+125|section\s+144)\b/i.test(
      lower,
    );

  return !hasMaintenanceOrderChallenge;
}

/** India court pleading kinds — checked before generic contract/employment heuristics. */
export function resolveIndiaCourtPleadingKind(haystack: string): string | undefined {
  // ─── Discharge application (must beat maintenance / civil noise from spouse facts) ─
  if (
    /\b(?:application\s+for\s+discharge|discharge\s+application|seeks?\s+discharge)\b/i.test(
      haystack,
    ) ||
    /\bbnss\s*§?\s*250\b|\bbnss\s*§?\s*262\b|section\s+250\s+(?:of\s+)?(?:the\s+)?bnss|section\s+262\s+(?:of\s+)?(?:the\s+)?bnss/i.test(
      haystack,
    )
  ) {
    return 'discharge_application';
  }

  // ─── Matrimonial dissolution (must come before the maintenance block) ─────────
  // Divorce / judicial separation / restitution of conjugal rights as PRIMARY relief.
  // Maintenance/alimony that appears only as ancillary relief must not override these.
  if (hasPrimaryMatrimonialReliefContext(haystack)) {
    if (/\b(restitution\s+of\s+conjugal\s+rights|section\s+9\s+(of\s+)?hma)\b/i.test(haystack)) {
      return 'restitution_conjugal_rights';
    }
    if (
      /\b(judicial\s+sep(aration)?|section\s+10\s+(of\s+)?(the\s+)?hma|hma\s+(sec(tion)?\.?\s*)?10\b|petition\s+(for|of)\s+sep(aration)?)\b/i.test(
        haystack,
      )
    ) {
      return 'judicial_separation';
    }
    return 'divorce_petition';
  }

  // Explicit "Criminal Revision Petition" wins over the generic maintenance block even when
  // "maintenance" appears in the pasted case description.
  if (/\bcriminal\s+revision\s+petition\b/i.test(haystack)) {
    return /maintenance|crpc\s*125|bnss\s*144/i.test(haystack)
      ? 'maintenance_order_revision'
      : 'criminal_revision';
  }

  // HMA §24 / Family Court maintenance — civil remedy, not criminal revision
  if (
    /section\s+24\s+(of\s+)?(the\s+)?hma\b|hma\s+(sec(tion)?\.?\s*)?24\b|section\s+24\s+(of\s+)?hindu\s+marriage|hindu\s+marriage\s+act.*maintenance.*family\s+court|family\s+court.*maintenance.*hindu\s+marriage/i.test(
      haystack,
    )
  ) {
    if (/article\s+227|art\.?\s*227/i.test(haystack)) return 'hma_article_227_challenge';
    if (/civil\s+revision/i.test(haystack)) return 'hma_civil_revision';
    return 'hma_section_24_challenge';
  }

  if (
    /maintenance|crpc\s*§?\s*125|crpc\s+125|bnss\s*§?\s*144|bnss\s+144|section\s+125|section\s+144/i.test(
      haystack,
    )
  ) {
    if (/interim\s+(?:maintenance\s+)?order|interim\s+maintenance|interim\s+relief/i.test(haystack)) {
      return 'maintenance_order_revision';
    }
    if (/final\s+(?:maintenance\s+)?order|final\s+maintenance|disposed\s+on\s+merits/i.test(haystack)) {
      return 'maintenance_appeal_final';
    }
    if (/revision|set aside|challenge.*order|against.*order/i.test(haystack)) {
      return 'maintenance_order_revision';
    }
    if (/appeal|memorandum of appeal/i.test(haystack)) {
      return 'maintenance_appeal_final';
    }
    return 'maintenance_application';
  }
  if (/special leave|slp|petition for special leave/i.test(haystack)) {
    return 'slp_petition';
  }
  if (
    /writ petition|habeas corpus|certiorari|mandamus|prohibition|quo warranto|article\s+226|article\s+32/i.test(
      haystack,
    ) ||
    // Factual descriptions of habeas corpus situations — no explicit legal vocabulary required
    /not produced before.{0,40}magistrate|unproduced.{0,30}magistrate|production.{0,30}magistrate/i.test(
      haystack,
    ) ||
    /whereabouts.{0,40}unknown|location.{0,30}undisclosed|location.{0,30}not.{0,20}disclosed/i.test(
      haystack,
    ) ||
    /unrecorded.{0,20}(?:custody|detention)|illegal.{0,20}detention|unlawful.{0,20}detention/i.test(
      haystack,
    ) ||
    /(?:denied|deny).{0,30}custody|custody.{0,30}denied|police.{0,20}denied/i.test(haystack) ||
    /no.{0,10}(?:fir|first information report).{0,30}(?:found|located|registered)/i.test(haystack) ||
    /not.{0,15}produced.{0,30}(?:24|twenty.four)\s*hour/i.test(haystack)
  ) {
    return 'writ_petition';
  }
  if (/criminal revision|revision petition|bnss\s*§?\s*438|crpc\s*§?\s*397/i.test(haystack)) {
    return 'criminal_revision';
  }
  if (/civil revision|revision under cpc|cpc\s*§?\s*115/i.test(haystack)) {
    return 'civil_revision';
  }
  if (/criminal appeal|memorandum of criminal appeal|bnss\s*§?\s*427|appeal against conviction|appeal against acquittal/i.test(haystack)) {
    return 'criminal_appeal';
  }
  if (/civil appeal|second appeal|appeal to high court|cpc\s*§?\s*96|cpc\s*§?\s*100/i.test(haystack)) {
    return 'civil_appeal';
  }
  if (/\bappeal\b/i.test(haystack) && !/appeal letter|appeal against decision to/i.test(haystack)) {
    return 'criminal_appeal';
  }
  if (/revision\b/i.test(haystack)) {
    return 'criminal_revision';
  }
  if (/quashing|528|482 crpc/i.test(haystack)) {
    return 'quashing_petition';
  }
  if (/bail application|anticipatory bail|regular bail|default bail/i.test(haystack)) {
    return 'bail_application';
  }
  if (
    /\b(order\s*(?:xxxvii|37)|summary\s+suit)\b/i.test(haystack) &&
    /\b(recover|recovery|debt|dues|invoice|purchase\s+order|written\s+contract)\b/i.test(
      haystack,
    )
  ) {
    return 'summary_suit_recovery';
  }
  if (
    /\b(money\s+recovery|commercial\s+recovery|recover(?:y)?\s+(?:of\s+)?(?:dues|debt|invoice)|unpaid\s+invoices?)\b/i.test(
      haystack,
    )
  ) {
    return 'money_recovery_suit';
  }
  if (/cheque bounce|ni act|section\s+138|dishonour of cheque/i.test(haystack)) {
    return 'cheque_bounce_complaint';
  }
  if (
    /\b(specific performance|agreement to sell|sale agreement)\b/i.test(haystack) &&
    /\b(sold|third party|breach|injunction|damages|advance|plaint|suit|wants|seeks)\b/i.test(haystack)
  ) {
    return 'civil_plaint';
  }
  if (/\bplaint\b|written statement|money recovery suit|injunction suit/i.test(haystack)) {
    return 'civil_plaint';
  }

  return undefined;
}

/**
 * These document kinds are always resolved from the query text before the MI profile is
 * consulted. The MI pipeline classifies by legal vocabulary but misses factual descriptions
 * of constitutional violations — e.g. a habeas corpus scenario described as "police took X,
 * not produced before magistrate" will be tagged as criminal/bail by MI even though the
 * correct document is a Writ Petition / Habeas Corpus Petition.
 */
const TEXT_WINS_OVER_MI_KINDS = new Set([
  'writ_petition',
  'slp_petition',
  'quashing_petition',
  'divorce_petition',
  'judicial_separation',
  'restitution_conjugal_rights',
  'police_complaint',
  'consumer_complaint',
  'civil_plaint',
  'summary_suit_recovery',
  'money_recovery_suit',
  'protective_injunction',
  'bail_application',
  'discharge_application',
  'defense_memo',
]);

/** Profile-first document kind resolution — Matter Intelligence Platform v2. */
export function resolveMatterDocumentKind(
  profile: {
    documentKind?: string;
    nature?: string;
    subPracticeArea?: string;
    practiceArea?: string;
    curatedKinds?: string[];
  } | undefined,
  query?: string,
  planningAnswers?: Record<string, string>,
): string {
  // Run text-based detection first for constitutional / procedural document kinds.
  // These are reliably identified by the query text alone, and the MI pipeline can
  // misclassify factual descriptions of constitutional violations as criminal/bail.
  if (query) {
    const textKind = resolveDocumentKind(undefined, query, planningAnswers);
    if (textKind && TEXT_WINS_OVER_MI_KINDS.has(textKind)) {
      return textKind;
    }
  }

  if (profile?.documentKind) {
    return profile.documentKind;
  }

  if (
    profile?.nature === 'dispute' &&
    profile.practiceArea === 'employment_labour' &&
    (profile.subPracticeArea === 'wrongful_termination' || profile.subPracticeArea === 'wage_dispute')
  ) {
    return 'wrongful_termination_petition';
  }

  if (
    profile?.nature === 'dispute' &&
    profile.practiceArea === 'real_estate_property' &&
    profile.subPracticeArea === 'specific_performance'
  ) {
    return 'civil_plaint';
  }

  if (profile?.curatedKinds?.length) {
    const kindMap: Record<string, string> = {
      india_wrongful_termination: 'wrongful_termination_petition',
      india_labour_court_application: 'wrongful_termination_petition',
      india_employment_legal_opinion: 'employment_legal_opinion',
      india_illegal_termination_demand_notice: 'illegal_termination_demand_notice',
      india_divorce_petition_s13: 'divorce_petition',
      india_divorce_mutual_consent: 'divorce_petition',
      india_restitution_conjugal_rights: 'restitution_conjugal_rights',
    };
    const mapped = kindMap[profile.curatedKinds[0]];
    if (mapped) return mapped;
  }

  if (
    profile?.nature === 'dispute' &&
    profile.practiceArea === 'family_matrimonial' &&
    profile.subPracticeArea === 'divorce'
  ) {
    return 'divorce_petition';
  }

  return resolveDocumentKind(undefined, query, planningAnswers);
}
