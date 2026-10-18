import type { JurisdictionForm } from '@prisma/client';
import { ALL_DOCUMENT_KINDS, resolveDocumentKind } from '@/config/templates/document-kinds';
import { INDIA_DRAFT_KINDS } from '../india-draft/india-draft-prompts';
import { US_DRAFT_KINDS } from '../us-draft/us-draft.dto';
import { isCriminalDischargeContext } from './draft-intent-bundles';
import { extractMatterFacts } from './matter-fact-extractor';
import {
  KENYA_DRAFT_CATALOG,
  KENYA_FORM_CATALOG_KIND,
  getKenyaDraftCatalogEntry,
  resolveKenyaDraftKind,
} from '@/config/templates/kenya-drafting-catalog';

const IN_REFERENCE_KIND: Record<string, string> = {
  'MCA-DIR-12': 'india_mca_dir12_appointment',
  'MCA-MGT-7': 'india_mca_mgt7_annual_return',
  'MCA-AOC-4': 'india_mca_aoc4_financials',
  'NCLT-CIRP': 'india_nclt_cirp_real_estate',
  'NCLT-IBC-7': 'india_nclt_cirp_real_estate',
  'DRT-OA': 'india_drt_oa',
  'GST-REG-01': 'india_gst_registration_application',
  'BAIL-APP': 'india_regular_bail_bnss_480',
  'QUASHING-PET': 'india_quashing_petition_bnss_528',
  'WRIT-PET-A226': 'india_writ_petition_hc',
  'SLP-SC': 'india_slp_draft',
  'RENT-PETITION': 'india_eviction_suit',
  'STAMP-ADJ': 'india_stamp_duty_adjudication',
  'SEBI-LODR': 'india_sebi_lodr_disclosure',
};

const DOCUMENT_KIND_SET = new Set<string>(ALL_DOCUMENT_KINDS);

function isKnownDocumentKind(value: unknown): value is string {
  return typeof value === 'string' && DOCUMENT_KIND_SET.has(value);
}

function resolveIndiaDraftKind(form: JurisdictionForm): string {
  const num = form.formNumber ?? '';
  if (IN_REFERENCE_KIND[num]) return IN_REFERENCE_KIND[num];

  const name = form.formName.toLowerCase();
  if (name.includes('bail')) return 'india_regular_bail_bnss_480';
  if (name.includes('writ')) return 'india_writ_petition_hc';
  if (name.includes('quashing')) return 'india_quashing_petition_bnss_528';
  if (name.includes('consumer')) return 'india_consumer_complaint';
  if (name.includes('arbitration')) return 'india_arbitration_notice_s21';
  if (name.includes('rent') || name.includes('eviction')) return 'india_eviction_suit';

  return 'india_form_catalog';
}

export function buildOfficialFormDraftUrl(form: JurisdictionForm): string | null {
  if (form.countryCode === 'IN') {
    const kind = resolveIndiaDraftKind(form);
    const params = new URLSearchParams({
      kind,
      label: form.formName,
      subtitle: form.authority,
    });
    if (kind === 'india_form_catalog') {
      if (form.formNumber) params.set('formNumber', form.formNumber);
      params.set('formTitle', form.formName);
      params.set('authority', form.authority);
      if (form.jurisdiction) params.set('jurisdiction', form.jurisdiction);
      if (form.practiceArea) params.set('practiceArea', form.practiceArea);
    }
    return `/app/india-drafting/draft?${params.toString()}`;
  }

  if (form.countryCode === 'KE') {
    const entry = getKenyaDraftCatalogEntry(
      isKnownDocumentKind(form.category) ? form.category : resolveDocumentKind(undefined, form.formName),
    );
    const params = new URLSearchParams({
      countryCode: 'KE',
      documentKind: entry?.documentKind ?? KENYA_FORM_CATALOG_KIND,
      query: form.formName,
      jurisdiction: form.jurisdiction ?? 'Kenya',
      verificationJurisdiction: 'Kenya',
      advocateReviewStatus: entry?.advocateReview.status ?? 'pending',
    });
    if (form.formNumber) params.set('formNumber', form.formNumber);
    params.set('authority', form.authority);
    return `/app/document-drafting/use?${params.toString()}`;
  }

  if (form.countryCode === 'US' || form.countryCode === 'GB') {
    const params = new URLSearchParams({
      kind: 'us_form_catalog',
      label: form.formName,
      subtitle: form.formNumber ?? form.authority,
      jurisdiction: form.countryCode === 'US' ? 'Federal' : form.countryCode,
      requiresState: 'false',
    });
    if (form.formNumber) params.set('formNumber', form.formNumber);
    if (form.jurisdiction && form.countryCode === 'US') {
      params.set('stateCode', form.jurisdiction);
      params.set('requiresState', 'true');
      params.set('boundState', form.jurisdiction);
    }
    params.set('formTitle', form.formName);
    return `/app/us-drafting/draft?${params.toString()}`;
  }

  return null;
}

export function buildCuratedDraftUrl(
  kind: string,
  countryCode: 'IN' | 'US' | 'GB' | 'KE',
  label: string,
): string {
  if (countryCode === 'KE' || kind.startsWith('kenya_')) {
    const entry = getKenyaDraftCatalogEntry(kind);
    const params = new URLSearchParams({
      countryCode: 'KE',
      documentKind: entry?.documentKind ?? kind,
      jurisdiction: 'Kenya',
      verificationJurisdiction: 'Kenya',
      advocateReviewStatus: entry?.advocateReview.status ?? 'pending',
    });
    return `/app/document-drafting/use?${params.toString()}`;
  }

  if (countryCode === 'IN' || kind.startsWith('india_')) {
    const params = new URLSearchParams({
      kind,
      label,
      subtitle: 'AI drafting',
    });
    return `/app/india-drafting/draft?${params.toString()}`;
  }

  const params = new URLSearchParams({
    kind,
    label,
    subtitle: 'AI drafting',
    jurisdiction: countryCode === 'US' ? 'Federal' : countryCode,
    requiresState: 'false',
  });
  return `/app/us-drafting/draft?${params.toString()}`;
}

function kindToLabel(kind: string): string {
  return kind
    .replace(/^(india_|us_|kenya_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CURATED_LABEL_MAP: Record<string, string> = {
  india_maintenance_order_revision: 'Appeal / Revision against Maintenance Order',
  india_maintenance_appeal_final: 'Appeal against Final Maintenance Order',
  india_maintenance_application_bnss_144: 'Maintenance Application (BNSS §144)',
  india_criminal_revision: 'Criminal Revision Petition',
  india_criminal_appeal: 'Criminal Appeal',
  india_civil_appeal_hc: 'Civil Appeal (High Court)',
  india_writ_petition_hc: 'Writ Petition (High Court)',
  india_habeas_corpus_petition: 'Habeas Corpus Petition — Art. 226 / 32',
  india_regular_bail_bnss_480: 'Regular Bail Application',
  india_discharge_application_bnss_250: 'Discharge Application (BNSS §250)',
  india_slp_draft: 'Special Leave Petition',
  india_quashing_petition_bnss_528: 'Quashing Petition',
  india_consumer_complaint: 'Consumer Complaint',
  india_legal_research_memo: 'Legal Research Memorandum',
  india_interim_application_document_production:
    'Interim Application — Preservation & Production',
  india_case_strategy_memo: 'Case Strategy Memo',
  india_cheque_bounce_complaint_ni138: 'Cheque Bounce Complaint',
  india_civil_plaint: 'Civil Suit / Plaint',
  india_application_temp_injunction: 'Interim Injunction Application',
  india_suit_specific_performance: 'Suit for Specific Performance',
  india_legal_notice: 'Legal Notice',
  india_nda_agreement: 'Non-Disclosure Agreement',
  india_divorce_petition_s13: 'Divorce Petition (HMA §13)',
  india_hma_interim_maintenance_s24: 'Interim Maintenance & Litigation Expenses — HMA §24',
  india_hma_custody_interim_s26: 'Interim Custody, Visitation & Child Expenses — HMA §26',
  india_domestic_violence_petition: 'Domestic Violence Application — PWDVA §12',
  india_maintenance_application_bnss_144_family: 'Maintenance Application for Wife and Child — BNSS §144',
  india_financial_disclosure_affidavit: 'Financial Disclosure / Assets & Liabilities Affidavit',
  india_stridhan_recovery_application: 'Application for Return / Protection of Jewellery & Personal Articles',
  india_divorce_mutual_consent: 'Divorce by Mutual Consent (HMA §13-B)',
  india_restitution_conjugal_rights: 'Petition for Restitution of Conjugal Rights (HMA §9)',
  india_article_227_petition: 'Article 227 Petition — Supervisory Jurisdiction',
  india_hma_civil_revision: 'Civil Revision Application (HMA §24)',
  india_hma_section_24_challenge: 'Challenge to HMA §24 Maintenance Order',
  india_fir_complaint:
    'Police Complaint Seeking Registration of FIR (Stalking — BNS §78 / BNSS §173)',
  india_complaint_magistrate_bnss_223:
    'Private Criminal Complaint before the Jurisdictional Magistrate',
  india_cyber_crime_complaint: 'Cyber Crime Complaint (online / electronic conduct)',
  india_reply_to_chargesheet: 'Reply to Chargesheet',
};

const CURATED_PROCEDURAL_NOTES: Record<string, string> = {
  india_divorce_petition_s13:
    'Filed before the Family Court under HMA §13 on the grounds of cruelty and/or desertion. Ancillary reliefs (maintenance, permanent alimony, custody) are claimed in the same petition or by separate application.',
  india_hma_interim_maintenance_s24:
    'HMA §24 covers maintenance pendente lite and expenses of the proceedings during a pending matrimonial case.',
  india_hma_custody_interim_s26:
    'HMA §26 governs interim custody, visitation, and related child expenses in matrimonial proceedings.',
  india_domestic_violence_petition:
    'PWDVA §12 application — protection, residence, monetary relief, and interim orders under §§18–23 are independent civil remedies.',
  india_maintenance_application_bnss_144_family:
    'BNSS §144 (formerly CrPC §125) provides maintenance for wives, children, and parents.',
  india_financial_disclosure_affidavit:
    'Income and asset disclosure supports maintenance, litigation expense, and child expense claims.',
  india_stridhan_recovery_application:
    'Seek return or protection of stridhan, jewellery, and personal articles.',
  india_divorce_mutual_consent:
    'Both parties must consent. Filed under HMA §13-B in two stages: first motion (joint petition), followed by a six-month cooling-off period (waivable by court), and second motion hearing.',
  india_restitution_conjugal_rights:
    'Filed under HMA §9 by the aggrieved spouse when the other has withdrawn from society without reasonable excuse. A decree of restitution does not bar a subsequent divorce petition.',
  india_maintenance_order_revision:
    'Filed as a Criminal Revision Petition under BNSS §438. Interim maintenance orders are challenged by revision, not a memorandum of appeal — the draft will reflect this.',
  india_article_227_petition:
    'HMA §24 interim maintenance orders from the Family Court are challenged before the High Court under Article 227 (supervisory jurisdiction), not by criminal revision.',
  india_hma_civil_revision:
    'Filed as a Civil Revision Application before the High Court or District Court depending on the High Court rules of your state.',
  india_hma_section_24_challenge:
    'The correct remedy for HMA §24 Family Court orders depends on your High Court practice. Most High Courts entertain Article 227 petitions for interlocutory maintenance orders.',
  india_habeas_corpus_petition:
    'Filed before the High Court under Article 226 or the Supreme Court under Article 32. Seeks immediate production of the detained person and challenges the lawfulness of their detention.',
  india_discharge_application_bnss_250:
    'Filed under BNSS §250 (Sessions) or §262 (warrant case on police report) after chargesheet and before charge is framed. Argues that the prosecution material does not disclose a case for trial.',
  india_fir_complaint:
    'Information concerning a cognizable offence (including stalking under BNS §78) is ordinarily given to the Station House Officer under BNSS §173. The complainant does not draft the FIR itself — the police register it based on the information supplied.',
  india_complaint_magistrate_bnss_223:
    'Private criminal complaint before the jurisdictional Magistrate. Consider when police do not register or act on the complaint, counsel deliberately chooses this route, or escalation steps have already been pursued. BNSS §223 concerns examination after cognizance — it is not the primary filing label.',
  india_cyber_crime_complaint:
    'Use when the conduct involves social media monitoring, repeated online messages, fake accounts, email monitoring, electronic surveillance, online threats, digital impersonation, or misuse of images.',
};

/**
 * Returns a user-friendly label and optional procedural note for a curated draft kind.
 * For maintenance queries where the user says "appeal" but the law requires "revision",
 * the label is adjusted and a short note is added to explain the procedural vehicle.
 */
export function resolveCuratedDraftLabel(
  documentKind: string,
  draftKind: string,
  query: string,
): { label: string; proceduralNote?: string } {
  let label = CURATED_LABEL_MAP[draftKind] ?? kindToLabel(draftKind);

  // Honour the user's stated document type in the assignment / query.
  if (
    draftKind === 'india_maintenance_order_revision' &&
    /\bcriminal\s+revision\s+petition\b/i.test(query)
  ) {
    return {
      label: 'Criminal Revision Petition',
      proceduralNote: CURATED_PROCEDURAL_NOTES[draftKind],
    };
  }

  // When the user explicitly said "appeal" but the correct vehicle is revision,
  // return a user-facing label that acknowledges their intent while explaining the vehicle.
  if (
    draftKind === 'india_maintenance_order_revision' &&
    /\bappeal\b/i.test(query)
  ) {
    return {
      label: 'Appeal against Interim Maintenance Order',
      proceduralNote: CURATED_PROCEDURAL_NOTES[draftKind],
    };
  }

  // Surface BNS §78 when cited or stalking is alleged on the police-complaint draft.
  if (
    draftKind === 'india_fir_complaint' &&
    (/\b(?:section|sec\.?|s\.?|§)\s*78\b.{0,20}\bbns\b|\bbns\b.{0,20}(?:section|sec\.?|s\.?|§)?\s*78\b|\bstalk/i.test(
      query,
    ))
  ) {
    label =
      'Police Complaint Seeking Registration of FIR (Stalking — BNS §78 / BNSS §173)';
  }

  return {
    label,
    proceduralNote: CURATED_PROCEDURAL_NOTES[draftKind],
  };
}

/** Category tag for a given curated kind (used to pre-set category on the draft editor). */
export function resolveCuratedDraftCategory(draftKind: string): string | undefined {
  if (/maintenance|divorce|custody|family|muslim_maintenance/i.test(draftKind)) return 'Family';
  if (/bail|criminal|quashing|slp/i.test(draftKind)) return 'Criminal';
  if (/writ|civil_appeal|civil_revision|civil_plaint/i.test(draftKind)) return 'Civil';
  if (/consumer/i.test(draftKind)) return 'Consumer';
  if (/legal_research_memo|case_strategy_memo/i.test(draftKind)) return 'Research';
  if (/document_production|interim_application_document/i.test(draftKind)) return 'Consumer';
  if (/cheque|ni_act/i.test(draftKind)) return 'Criminal';
  if (/nda|agreement|partnership|contract/i.test(draftKind)) return 'Commercial';
  return undefined;
}

export interface CuratedDraftEntry {
  kind: string;
  label: string;
  countryCode: 'IN' | 'US' | 'GB' | 'KE';
  advocateReviewStatus?: 'pending' | 'reviewed';
  requiredAuthorityFields?: string[];
}

const GB_CURATED_DRAFTS: CuratedDraftEntry[] = [
  {
    kind: 'us_form_catalog',
    label: 'Domestic Violence / Non-Molestation Application',
    countryCode: 'GB',
  },
  {
    kind: 'us_form_catalog',
    label: 'Divorce / Financial Remedy Application',
    countryCode: 'GB',
  },
];

export function listCuratedDraftEntries(): CuratedDraftEntry[] {
  const india = INDIA_DRAFT_KINDS.filter((k) => k !== 'india_form_catalog').map((kind) => ({
    kind,
    label: kindToLabel(kind),
    countryCode: 'IN' as const,
  }));
  const us = US_DRAFT_KINDS.filter((k) => k !== 'us_form_catalog').map((kind) => ({
    kind,
    label: kindToLabel(kind),
    countryCode: 'US' as const,
  }));
  const kenya = KENYA_DRAFT_CATALOG.map(({ kind, label, advocateReview, requiredAuthorityFields }) => ({
    kind,
    label,
    countryCode: 'KE' as const,
    advocateReviewStatus: advocateReview.status,
    requiredAuthorityFields: requiredAuthorityFields
      .filter((field) => field.required)
      .map((field) => field.label),
  }));
  return [...india, ...us, ...kenya, ...GB_CURATED_DRAFTS];
}

const SEARCH_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'has',
  'had',
  'was',
  'were',
  'are',
  'you',
  'your',
  'our',
  'their',
  'about',
  'need',
  'want',
  'would',
  'could',
  'should',
  'draft',
  'make',
  'create',
  'write',
  'help',
  'please',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !SEARCH_STOPWORDS.has(t));
}

/** Expand NL queries with catalog keywords so lexical search finds the right forms. */
export function expandSearchTokens(query: string): string[] {
  const tokens = tokenize(query);
  const lower = query.toLowerCase();
  const extra: string[] = [];
  const selfDefenseHomicide = extractMatterFacts(query).isSelfDefenseHomicideContext;

  if (
    /domestic violence|protective order|non.?molestation|restraining order|non molestation|abuse|assaulted|attacked|harm and domestic/i.test(
      lower,
    ) ||
    // Bare spouse words must not pollute criminal self-defence / discharge matters.
    (!selfDefenseHomicide && /husband|wife|partner|spouse/.test(lower))
  ) {
    extra.push('domestic', 'violence', 'harm', 'family', 'matrimonial', 'molestation');
  }
  if (/police complaint|\bfir\b|criminal complaint|first information report/i.test(lower)) {
    extra.push('police', 'criminal', 'complaint', 'fir');
  }
  if (/nda|non.?disclosure|confidentiality agreement/i.test(lower)) {
    extra.push('nda', 'confidentiality', 'non-disclosure');
  }
  if (
    /service agreement|contractor agreement|consulting agreement|master service|msa|scope of work/i.test(
      lower,
    )
  ) {
    extra.push('service', 'agreement', 'contract');
  }
  if (/partnership|partner deed|partnership deed/i.test(lower)) {
    extra.push('partnership', 'deed');
  }
  if (
    /\b(order\s*(?:xxxvii|37)|summary\s+suit|commercial\s+recovery|money\s+recovery|unpaid\s+invoices?|purchase\s+order)\b/i.test(
      lower,
    )
  ) {
    extra.push('summary', 'suit', 'recovery', 'commercial', 'invoice', 'cpc', 'xxxvii');
  }
  if (/bail|custody release/i.test(lower)) {
    extra.push('bail');
  }
  if (
    /\b(?:application\s+for\s+discharge|discharge\s+application|seeks?\s+discharge)\b/i.test(lower) ||
    /\bbnss\s*§?\s*250\b|\bbnss\s*§?\s*262\b/i.test(lower) ||
    isCriminalDischargeContext(query)
  ) {
    extra.push('discharge', 'bnss', '250', 'chargesheet', 'criminal');
  }
  if (/writ petition|habeas|mandamus/i.test(lower)) {
    extra.push('writ', 'petition');
  }
  if (
    !selfDefenseHomicide &&
    /maintenance|crpc\s*125|bnss\s*144|125 crpc/i.test(lower)
  ) {
    extra.push('maintenance', 'crpc', 'bnss', 'family');
  }
  if (
    !selfDefenseHomicide &&
    /divorce|dissolution\s+of\s+marriage|judicial\s+separation|section\s+13\s+hma|hma\s+13\b|cruelty|desertion|matrimonial\s+home/i.test(
      lower,
    )
  ) {
    extra.push('divorce', 'petition', 'family', 'matrimonial', 'hma');
  }
  if (/appeal|revision|writ|slp|special leave/i.test(lower)) {
    extra.push('appeal', 'revision', 'court');
  }
  if (/quashing|bail|cheque bounce|ni act|138/i.test(lower)) {
    extra.push('criminal');
  }
  if (
    /\bstalk(?:s|ing|ed)?\b|\bcyber\s*-?\s*stalk/i.test(lower) ||
    /\b(?:section|sec\.?|s\.?|§)\s*78\b.{0,20}\bbns\b|\bbns\b.{0,20}(?:section|sec\.?|s\.?|§)?\s*78\b/i.test(
      lower,
    )
  ) {
    extra.push(
      'stalking',
      'harassment',
      'fir',
      'police',
      'complaint',
      'criminal',
      'bns',
      '78',
      'bnss',
      '173',
      'magistrate',
    );
  }

  return [...new Set([...tokens, ...extra])];
}

export function scoreTextMatch(query: string, target: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const haystack = target.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

/** True when resolveDocumentKind matched a specific phrase, not the generic default. */
export function isExplicitDocumentKind(documentKind: string, query: string): boolean {
  const lower = query.toLowerCase();
  if (documentKind === 'unknown' || documentKind === 'unknown_filing') return false;
  if (documentKind !== 'service_agreement') return true;
  return /\b(service agreement|contractor agreement|consulting agreement|consultancy agreement|freelance|scope of work|master service|msa)\b/i.test(
    lower,
  );
}

/** Document kind when the user has named a specific filing (e.g. "Criminal Revision Petition"). */
export function resolveExplicitDocumentKindFromQuery(query: string): string | undefined {
  const kind = resolveDocumentKind(undefined, query);
  return isExplicitDocumentKind(kind, query) ? kind : undefined;
}

/** Skip statute-picker questions when the user already named the document they want drafted. */
export function shouldSkipClarifyingQuestions(query: string): boolean {
  return resolveExplicitDocumentKindFromQuery(query) !== undefined;
}

const DRAFT_KIND_BY_DOCUMENT: Record<
  string,
  Partial<Record<'IN' | 'US' | 'GB' | 'KE', string>> & { default?: string }
> = {
  partnership_agreement: {
    IN: 'india_partnership_deed',
    US: 'us_form_catalog',
    KE: KENYA_FORM_CATALOG_KIND,
    GB: 'us_form_catalog',
    default: 'india_partnership_deed',
  },
  partnership_deed: {
    IN: 'india_partnership_deed',
    US: 'us_form_catalog',
    default: 'india_partnership_deed',
  },
  service_agreement: {
    IN: 'india_service_agreement_india',
    US: 'us_form_catalog',
    KE: KENYA_FORM_CATALOG_KIND,
    default: 'india_service_agreement_india',
  },
  shareholders_agreement: {
    IN: 'india_form_catalog',
    US: 'us_form_catalog',
    KE: KENYA_FORM_CATALOG_KIND,
    default: 'us_form_catalog',
  },
  llc_operating_agreement: {
    US: 'us_state_llc_formation',
    default: 'us_state_llc_formation',
  },
  protective_injunction: {
    IN: 'india_domestic_violence_petition',
    US: 'us_state_restraining_order',
    GB: 'us_form_catalog',
    KE: KENYA_FORM_CATALOG_KIND,
    default: 'india_domestic_violence_petition',
  },
  police_complaint: {
    IN: 'india_fir_complaint',
    US: 'us_state_criminal_complaint',
    GB: 'us_form_catalog',
    KE: KENYA_FORM_CATALOG_KIND,
    default: 'india_fir_complaint',
  },
  criminal_complaint: {
    IN: 'india_fir_complaint',
    US: 'us_state_criminal_complaint',
    KE: KENYA_FORM_CATALOG_KIND,
    default: 'india_fir_complaint',
  },
  maintenance_order_revision: {
    IN: 'india_maintenance_order_revision',
    default: 'india_maintenance_order_revision',
  },
  maintenance_appeal_final: {
    IN: 'india_maintenance_appeal_final',
    default: 'india_maintenance_appeal_final',
  },
  maintenance_application: {
    IN: 'india_maintenance_application_bnss_144',
    default: 'india_maintenance_application_bnss_144',
  },
  criminal_appeal: {
    IN: 'india_criminal_appeal',
    default: 'india_criminal_appeal',
  },
  civil_appeal: {
    IN: 'india_civil_appeal_hc',
    default: 'india_civil_appeal_hc',
  },
  criminal_revision: {
    IN: 'india_criminal_revision',
    default: 'india_criminal_revision',
  },
  civil_revision: {
    IN: 'india_civil_revision',
    default: 'india_civil_revision',
  },
  hma_section_24_challenge: {
    IN: 'india_article_227_petition',
    default: 'india_article_227_petition',
  },
  hma_article_227_challenge: {
    IN: 'india_article_227_petition',
    default: 'india_article_227_petition',
  },
  hma_civil_revision: {
    IN: 'india_hma_civil_revision',
    default: 'india_hma_civil_revision',
  },
  hma_nullity_petition: {
    IN: 'india_divorce_petition_s13',
    default: 'india_divorce_petition_s13',
  },
  divorce_petition: {
    IN: 'india_divorce_petition_s13',
    default: 'india_divorce_petition_s13',
  },
  hma_interim_maintenance: {
    IN: 'india_hma_interim_maintenance_s24',
    default: 'india_hma_interim_maintenance_s24',
  },
  custody_petition: {
    IN: 'india_hma_custody_interim_s26',
    default: 'india_hma_custody_interim_s26',
  },
  dv_petition: {
    IN: 'india_domestic_violence_petition',
    default: 'india_domestic_violence_petition',
  },
  financial_disclosure_form: {
    IN: 'india_financial_disclosure_affidavit',
    default: 'india_financial_disclosure_affidavit',
  },
  stridhan_recovery: {
    IN: 'india_stridhan_recovery_application',
    default: 'india_stridhan_recovery_application',
  },
  judicial_separation: {
    IN: 'india_divorce_petition_s13',
    default: 'india_divorce_petition_s13',
  },
  restitution_conjugal_rights: {
    IN: 'india_restitution_conjugal_rights',
    default: 'india_restitution_conjugal_rights',
  },
  written_statement_matrimonial: {
    IN: 'india_written_statement',
    default: 'india_written_statement',
  },
  written_statement_dv: {
    IN: 'india_written_statement',
    default: 'india_written_statement',
  },
  writ_petition: {
    IN: 'india_writ_petition_hc',
    default: 'india_writ_petition_hc',
  },
  slp_petition: {
    IN: 'india_slp_draft',
    default: 'india_slp_draft',
  },
  quashing_petition: {
    IN: 'india_quashing_petition_bnss_528',
    default: 'india_quashing_petition_bnss_528',
  },
  bail_application: {
    IN: 'india_regular_bail_bnss_480',
    US: 'us_state_bail_motion',
    default: 'india_regular_bail_bnss_480',
  },
  discharge_application: {
    IN: 'india_discharge_application_bnss_250',
    default: 'india_discharge_application_bnss_250',
  },
  defense_memo: {
    IN: 'india_reply_to_chargesheet',
    default: 'india_reply_to_chargesheet',
  },
  cyber_complaint: {
    IN: 'india_cyber_crime_complaint',
    default: 'india_cyber_crime_complaint',
  },
  cheque_bounce_complaint: {
    IN: 'india_cheque_bounce_complaint_ni138',
    default: 'india_cheque_bounce_complaint_ni138',
  },
  consumer_complaint: {
    IN: 'india_consumer_complaint',
    default: 'india_consumer_complaint',
  },
  legal_research_memo: {
    IN: 'india_legal_research_memo',
    default: 'india_legal_research_memo',
  },
  interim_application_document_production: {
    IN: 'india_interim_application_document_production',
    default: 'india_interim_application_document_production',
  },
  case_strategy_memo: {
    IN: 'india_case_strategy_memo',
    default: 'india_case_strategy_memo',
  },
  civil_plaint: {
    IN: 'india_civil_plaint',
    KE: 'kenya_civil_plaint',
    default: 'india_civil_plaint',
  },
  summary_suit_recovery: {
    IN: 'india_suit_recovery_cpc_37',
    default: 'india_suit_recovery_cpc_37',
  },
  money_recovery_suit: {
    IN: 'india_civil_suit_money_recovery',
    default: 'india_civil_suit_money_recovery',
  },
  legal_notice: {
    IN: 'india_legal_notice',
    KE: 'kenya_demand_letter',
    default: 'india_legal_notice',
  },
  injunction_application: {
    IN: 'india_application_temp_injunction',
    default: 'india_application_temp_injunction',
  },
  specific_performance_suit: {
    IN: 'india_suit_specific_performance',
    default: 'india_suit_specific_performance',
  },
  wrongful_termination_petition: {
    IN: 'india_wrongful_termination',
    default: 'india_wrongful_termination',
  },
  employment_legal_opinion: {
    IN: 'india_employment_legal_opinion',
    default: 'india_employment_legal_opinion',
  },
  illegal_termination_demand_notice: {
    IN: 'india_illegal_termination_demand_notice',
    default: 'india_illegal_termination_demand_notice',
  },
};

/** Maps pre-analysis context (statute, order type, intent) to a document kind. */
export function resolveKindFromContext(
  context: {
    statute?: string;
    orderType?: string;
    documentIntent?: string;
    documentKind?: string;
  },
  query: string,
): string | undefined {
  const lower = query.toLowerCase();
  const isChallenge =
    context.documentIntent === 'challenge' ||
    /\brevision\b|set aside|challenge.*order|against.*order/i.test(lower);

  if (context.statute === 'hma_24') {
    if (/article\s+227|art\.?\s*227/i.test(lower)) return 'hma_article_227_challenge';
    if (/civil\s+revision/i.test(lower)) return 'hma_civil_revision';
    if (context.orderType === 'interim' || /interim/i.test(lower)) {
      return isChallenge ? 'maintenance_order_revision' : 'hma_section_24_challenge';
    }
    return 'hma_section_24_challenge';
  }

  if (context.statute === 'bnss_144') {
    if (context.orderType === 'final' || /final\s+(?:maintenance\s+)?order/i.test(lower)) {
      return 'maintenance_appeal_final';
    }
    if (isChallenge || context.orderType === 'interim' || /interim/i.test(lower)) {
      return 'maintenance_order_revision';
    }
    return 'maintenance_application';
  }

  if (context.statute === 'dv_act') {
    return 'protective_injunction';
  }

  if (context.orderType === 'interim' && /\bmaintenance\b/i.test(lower) && isChallenge) {
    return 'maintenance_order_revision';
  }

  if (isKnownDocumentKind(context.documentKind)) {
    return context.documentKind;
  }

  return undefined;
}

function firstAnswerValue(
  answers: Record<string, string | string[]>,
  questionId: string,
): string | undefined {
  const raw = answers[questionId];
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Stage-aware self-defence routing. Decisive goals win; `not_sure` uses fact inference.
 * FIR posture / custody only apply when the goal is missing or ambiguous.
 * Explicit discharge language in the query upgrades defence goals to discharge_application.
 */
export function resolveSelfDefenseKindFromAnswers(
  answers: Record<string, string | string[]>,
  query?: string,
): string | undefined {
  const goal = firstAnswerValue(answers, 'self_defense_goal');
  const fir = firstAnswerValue(answers, 'self_defense_fir_status');
  const custody = firstAnswerValue(answers, 'self_defense_custody_stage');
  const extracted = query ? extractMatterFacts(query) : undefined;
  const wantsDischarge =
    Boolean(query && isCriminalDischargeContext(query)) ||
    Boolean(extracted?.seeksDischarge) ||
    /\b(?:application\s+for\s+discharge|discharge\s+application|seeks?\s+discharge)\b/i.test(
      query ?? '',
    );
  const factChargesheet =
    Boolean(extracted?.hasChargesheetFiled) ||
    (fir === 'unknown' && Boolean(extracted?.hasChargesheetFiled));

  if (!goal && !fir && !custody) {
    // Facts alone can still drive a primary kind for provisional suggestions.
    if (wantsDischarge || factChargesheet) return 'discharge_application';
    if (extracted?.isSelfDefenseHomicideContext) return 'defense_memo';
    return undefined;
  }

  if (goal === 'file_fir_as_survivor') return 'police_complaint';
  if (goal === 'bail_or_anticipatory') return 'bail_application';
  if (goal === 'discharge_application') return 'discharge_application';
  if (goal === 'defense_against_homicide') {
    return wantsDischarge || factChargesheet ? 'discharge_application' : 'defense_memo';
  }
  if (goal === 'police_statement_only') {
    return factChargesheet || wantsDischarge ? 'discharge_application' : 'defense_memo';
  }

  // `not_sure` / missing goal — FIR posture, custody, and facts decide.
  const goalUndecided = !goal || goal === 'not_sure';

  if (goalUndecided) {
    if (fir === 'fir_against_attacker') return 'police_complaint';
    if (fir === 'fir_against_client' || (fir === 'unknown' && factChargesheet)) {
      return wantsDischarge || factChargesheet ? 'discharge_application' : 'defense_memo';
    }
    if (custody === 'arrest_feared') return 'bail_application';
    if (custody === 'in_custody_or_chargesheet') {
      return wantsDischarge || factChargesheet ? 'discharge_application' : 'bail_application';
    }
    // not_sure + unknown + pre_complaint but facts say chargesheet/discharge
    if (wantsDischarge || factChargesheet) return 'discharge_application';
    if (extracted?.isSelfDefenseHomicideContext) return 'defense_memo';
  }

  return undefined;
}

/**
 * Curated draft kind for the high-confidence inject pin.
 * Returns null when a single 96% pin would be wrong (e.g. pre-chargesheet defence).
 */
export function resolveCuratedDraftKindForInjection(
  documentKind: string,
  countryCode: string,
  answers?: Record<string, string | string[]>,
  query?: string,
): string | null {
  const normalized =
    countryCode === 'ALL' || !countryCode ? 'IN' : countryCode;
  const goal = answers ? firstAnswerValue(answers, 'self_defense_goal') : undefined;
  const fir = answers ? firstAnswerValue(answers, 'self_defense_fir_status') : undefined;
  const custody = answers ? firstAnswerValue(answers, 'self_defense_custody_stage') : undefined;
  const wantsDischarge =
    Boolean(query && isCriminalDischargeContext(query)) ||
    goal === 'discharge_application' ||
    documentKind === 'discharge_application';

  if (documentKind === 'bail_application' && (normalized === 'IN' || !countryCode || countryCode === 'ALL')) {
    if (custody === 'in_custody_or_chargesheet') {
      return 'india_regular_bail_bnss_480';
    }
    if (custody === 'arrest_feared' || goal === 'bail_or_anticipatory') {
      return 'india_anticipatory_bail_bnss_482';
    }
  }

  if (documentKind === 'discharge_application') {
    if (normalized === 'IN' || !countryCode || countryCode === 'ALL') {
      return 'india_discharge_application_bnss_250';
    }
  }

  if (documentKind === 'defense_memo') {
    const chargesheetStage =
      fir === 'fir_against_client' ||
      custody === 'in_custody_or_chargesheet' ||
      wantsDischarge ||
      Boolean(query && extractMatterFacts(query).hasChargesheetFiled);
    if (!chargesheetStage && goal === 'police_statement_only') {
      // Still allow a defence memo pin for statement-only (not reply-to-chargesheet).
      return 'india_reply_to_chargesheet';
    }
    if (!chargesheetStage) {
      // pre-complaint / defence without FIR against client —
      // do not pin Reply to Chargesheet at 96%.
      return null;
    }
    // Prefer discharge when the user asked for it (or facts say so) over reply-to-chargesheet.
    if (wantsDischarge && (normalized === 'IN' || !countryCode || countryCode === 'ALL')) {
      return 'india_discharge_application_bnss_250';
    }
  }

  const draftKind = documentKindToDraftKind(documentKind, countryCode);
  if (
    draftKind === 'india_form_catalog' ||
    draftKind === 'us_form_catalog' ||
    draftKind === KENYA_FORM_CATALOG_KIND
  ) {
    return null;
  }
  return draftKind;
}

/** Maps clarifying question answers back to a document kind for routing.
 *  Values may be a single string (single-select) or a string[] (multi-select).
 *  For multi-select, options are tried in the order they appear in the map. */
export function resolveKindFromAnswers(
  answers: Record<string, string | string[]>,
  query?: string,
): string | undefined {
  const explicitDocumentKind = answers.document_kind;
  const explicitValues = Array.isArray(explicitDocumentKind)
    ? explicitDocumentKind
    : explicitDocumentKind
      ? [explicitDocumentKind]
      : [];
  for (const value of explicitValues) {
    if (isKnownDocumentKind(value)) return value;
  }

  const selfDefenseKind = resolveSelfDefenseKindFromAnswers(answers, query);
  if (selfDefenseKind) return selfDefenseKind;

  const ANSWER_KIND_MAP: Record<string, Record<string, string>> = {
    maintenance_statute: {
      hma_24: 'hma_section_24_challenge',
      bnss_144: 'maintenance_order_revision',
      dv_act: 'maintenance_order_revision',
      not_sure: 'maintenance_application',
    },
    revision_type: {
      criminal: 'criminal_revision',
      civil: 'civil_revision',
    },
    // Priority order for multi-select: maintenance challenge → nullity → written statement
    relief_sought: {
      challenge_interim_maintenance: 'maintenance_order_revision',
      composite_revision: 'maintenance_order_revision',
      deny_marriage_validity: 'hma_nullity_petition',
      defend_dv_merits: 'written_statement_dv',
    },
    nature: {
      'Drafting a new contract or document': 'service_agreement',
      'Legal advice / opinion only': 'service_agreement',
    },
    practice_area: {
      'Family & Matrimonial': 'maintenance_order_revision',
      'Criminal / Litigation': 'police_complaint',
      Consumer: 'consumer_complaint',
      Property: 'civil_plaint',
      'Corporate / Contract': 'service_agreement',
    },
    stalking_conduct: {
      monitor_online: 'police_complaint',
      follow_physically: 'police_complaint',
      wait_outside: 'police_complaint',
      call_message: 'police_complaint',
      send_others: 'police_complaint',
      not_sure_yet: 'police_complaint',
    },
    stalking_aggravation: {
      police_refused: 'criminal_complaint',
    },
  };

  for (const [questionId, optionMap] of Object.entries(ANSWER_KIND_MAP)) {
    const raw = answers[questionId];
    if (!raw) continue;
    // Normalise to array to handle both single-select (string) and multi-select (string[])
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (optionMap[value]) return optionMap[value];
    }
  }
  return undefined;
}

/** True when user answered a question that routes to a concrete document kind. */
export function hasActionableClarifyingAnswers(
  answers?: Record<string, string | string[]>,
  query?: string,
): boolean {
  if (!answers || Object.keys(answers).length === 0) {
    // Facts alone (e.g. discharge language) can still be actionable for self-defence.
    if (query && resolveSelfDefenseKindFromAnswers({}, query)) return true;
    return false;
  }
  return Boolean(resolveKindFromAnswers(answers, query));
}

export function documentKindToDraftKind(
  documentKind: string,
  countryCode: string,
): string {
  const map = DRAFT_KIND_BY_DOCUMENT[documentKind];
  const normalized =
    countryCode === 'ALL' || !countryCode ? 'IN' : (countryCode as 'IN' | 'US' | 'GB' | 'KE');
  if (!map) {
    // Extended catalog slugs (e.g. india_consumer_complaint) are already draft kinds.
    if (normalized === 'IN' && INDIA_DRAFT_KINDS.includes(documentKind)) {
      return documentKind;
    }
    if (normalized === 'IN') return 'india_form_catalog';
    if (normalized === 'KE') return resolveKenyaDraftKind(documentKind);
    return 'us_form_catalog';
  }
  if (normalized === 'KE') {
    return map.KE ?? resolveKenyaDraftKind(documentKind);
  }
  return map[normalized] ?? map.default ?? 'us_form_catalog';
}

export function buildGenerateDraftUrl(
  documentKind: string,
  countryCode: 'IN' | 'US' | 'GB' | 'KE',
  label: string,
  options?: { details?: string; documentKind?: string },
): string {
  const draftKind = documentKindToDraftKind(documentKind, countryCode);
  let base: string;
  if (countryCode === 'KE' || draftKind.startsWith('kenya_')) {
    base = buildCuratedDraftUrl(draftKind, 'KE', label);
  } else if (countryCode === 'IN' || draftKind.startsWith('india_')) {
    base = buildCuratedDraftUrl(draftKind, 'IN', label);
  } else {
    const params = new URLSearchParams({
      kind: draftKind,
      label,
      subtitle: 'AI drafting',
      jurisdiction: countryCode === 'US' ? 'Federal' : countryCode,
      requiresState: 'false',
    });
    if (draftKind === 'us_form_catalog') {
      params.set('formTitle', label);
    }
    base = `/app/us-drafting/draft?${params.toString()}`;
  }
  const url = new URL(base, 'http://local');
  url.searchParams.set('documentKind', options?.documentKind ?? documentKind);
  if (options?.details?.trim()) {
    url.searchParams.set('details', options.details.trim().slice(0, 4000));
  }
  return `${url.pathname}${url.search}`;
}

export function buildTemplateUseUrl(
  templateId: string,
  options?: { query?: string; documentKind?: string; systemTemplate?: string },
): string {
  const params = new URLSearchParams({ templateId });
  if (options?.query?.trim()) params.set('query', options.query.trim().slice(0, 4000));
  if (options?.documentKind) params.set('documentKind', options.documentKind);
  if (options?.systemTemplate) params.set('systemTemplate', options.systemTemplate);
  return `/app/document-drafting/use?${params.toString()}`;
}

export function appendDraftUrlParams(
  draftUrl: string,
  options?: {
    details?: string;
    documentKind?: string;
    clientName?: string;
    opposingParty?: string;
    courtName?: string;
    language?: string;
  },
): string {
  if (
    !options?.details &&
    !options?.documentKind &&
    !options?.clientName &&
    !options?.opposingParty &&
    !options?.courtName &&
    !options?.language
  ) {
    return draftUrl;
  }
  const url = new URL(draftUrl, 'http://local');
  // Party/court params BEFORE details so long encoded details cannot truncate them.
  if (options.documentKind) url.searchParams.set('documentKind', options.documentKind);
  if (options.clientName?.trim()) url.searchParams.set('clientName', options.clientName.trim().slice(0, 200));
  if (options.opposingParty?.trim()) {
    url.searchParams.set('opposingParty', options.opposingParty.trim().slice(0, 200));
  }
  if (options.courtName?.trim()) url.searchParams.set('courtName', options.courtName.trim().slice(0, 200));
  if (options.language?.trim()) url.searchParams.set('language', options.language.trim().slice(0, 16));
  if (options.details?.trim()) url.searchParams.set('details', options.details.trim().slice(0, 4000));
  return `${url.pathname}${url.search}`;
}
