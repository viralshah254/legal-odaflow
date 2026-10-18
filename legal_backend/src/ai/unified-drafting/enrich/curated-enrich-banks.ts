/**
 * Human-reviewed case-law banks for enrich — never invented.
 * Per-family banks: bail, civil/SP, consumer, writ, arbitration, employment.
 */

import { CURATED_CONSUMER_SOURCE_BANK } from '@/ai/drafting/accuracy/curated-consumer-sources.util';
import { loadIndiaCaselawCorpus } from '@/legal-sources/load-india-caselaw-corpus';

export interface CuratedEnrichCase {
  caseId: string;
  citation: string;
  title: string;
  areas: string[];
  proposition: string;
  treatmentStatus: 'good_law' | 'overruled' | 'distinguished' | 'superseded' | 'repealed';
  court: string;
  decisionYear?: number;
  sourceUrl?: string;
}

function corpusEnrichCases(documentKind = '', rawFacts = ''): CuratedEnrichCase[] {
  const query = `${documentKind} ${rawFacts}`.toLowerCase();
  const terms = query.match(/[a-z_]{4,}/g) ?? [];
  return loadIndiaCaselawCorpus()
    .filter((entry) => entry.reviewedByHuman)
    .map((entry) => {
      const tags = [...(entry.enrichAreas ?? []), ...entry.topics, ...entry.draftKinds];
      const score = terms.filter((term) => tags.some((tag) => tag.toLowerCase().includes(term))).length;
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ entry }) => ({
      caseId: entry.id,
      citation: entry.citation,
      title: entry.title,
      areas: entry.enrichAreas ?? entry.topics,
      proposition: entry.holding ?? entry.summary,
      treatmentStatus: entry.treatmentStatus,
      court: entry.court,
      decisionYear: Number(entry.decisionDate?.slice(0, 4) ?? entry.citation.match(/\b(19|20)\d{2}\b/)?.[0]) || undefined,
      sourceUrl: entry.sourceUrl,
    }));
}

const BAIL_CASE_LAW_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__sanjay_chandra_v_cbi_2012',
    citation: '(2012) 1 SCC 40',
    title: 'Sanjay Chandra v. CBI',
    court: 'Supreme Court of India',
    decisionYear: 2012,
    treatmentStatus: 'good_law',
    areas: ['bail_is_the_rule', 'economic_offence_bail', 'bail_factors'],
    proposition:
      'Bail is the rule, jail is the exception. Economic offences require additional scrutiny but do not automatically exclude bail. Courts must consider: nature and gravity of accusation, antecedents, flight risk, and likelihood of repeating the offence.',
  },
  {
    caseId: 'curated__arnesh_kumar_v_state_bihar_2014',
    citation: '(2014) 8 SCC 273',
    title: 'Arnesh Kumar v. State of Bihar',
    court: 'Supreme Court of India',
    decisionYear: 2014,
    treatmentStatus: 'good_law',
    areas: ['arrest_necessity', 'liberty_rule', 'magistrate_duty'],
    proposition:
      'Arrest must be the last resort, not the first option. Police must satisfy themselves of the necessity of arrest before arresting in offences punishable up to 7 years. Mechanical arrest without application of mind is impermissible.',
  },
  {
    caseId: 'curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010',
    citation: '(2010) 14 SCC 496',
    title: 'Prasanta Kumar Sarkar v. Ashis Chatterjee',
    court: 'Supreme Court of India',
    decisionYear: 2010,
    treatmentStatus: 'good_law',
    areas: ['bail_factors', 'bail_test', 'witness_tampering'],
    proposition:
      'Bail factors: nature/gravity of accusation; character, behaviour, means, and standing of accused; prima facie satisfaction of court; reasonable apprehension of tampering with witnesses; likelihood of fleeing justice.',
  },
  {
    caseId: 'curated__gurucharan_das_v_state_1978',
    citation: 'AIR 1978 SC 179',
    title: 'Gurcharan Singh v. State (Delhi Administration)',
    court: 'Supreme Court of India',
    decisionYear: 1978,
    treatmentStatus: 'good_law',
    areas: ['sessions_bail_factors', 'bnss_483', 'bail_not_punishment'],
    proposition:
      'Bail considerations under CrPC §437/§439 (BNSS §480/§483): seriousness of accusation, possibility of absconsion, antecedents, prima facie case. Bail is not to be withheld as a form of punishment.',
  },
  {
    caseId: 'curated__satender_kumar_antil_v_cbi_2022',
    citation: '(2022) 10 SCC 51',
    title: 'Satender Kumar Antil v. CBI',
    court: 'Supreme Court of India',
    decisionYear: 2022,
    treatmentStatus: 'good_law',
    areas: ['bail_conditions', 'prolonged_detention', 'liberty_rule', 'default_bail'],
    proposition:
      'Comprehensive bail guidelines. No onerous conditions. Bail conditions must be reasonable. Prolonged incarceration without trial violates right to liberty. Default bail must be granted on completion of statutory period.',
  },
];

const ANTICIPATORY_CASE_LAW_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__siddharam_satlingappa_2011',
    citation: '(2011) 1 SCC 694',
    title: 'Siddharam Satlingappa Mhetre v. State of Maharashtra',
    court: 'Supreme Court of India',
    decisionYear: 2011,
    treatmentStatus: 'good_law',
    areas: ['anticipatory_bail_factors', 'bail_conditions', 'personal_liberty'],
    proposition:
      'Factors for anticipatory bail: nature and gravity of accusation; antecedents; possibility of fleeing justice; accusation made bona fide or with malice. Courts should not impose conditions that render anticipatory bail meaningless.',
  },
  ...BAIL_CASE_LAW_BANK,
];

const CIVIL_SPECIFIC_PERFORMANCE_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__ks_vidyanadam_v_vairavan_1997',
    citation: '(1997) 3 SCC 1',
    title: 'K.S. Vidyanadam v. Vairavan',
    court: 'Supreme Court of India',
    decisionYear: 1997,
    treatmentStatus: 'good_law',
    areas: ['specific_performance', 'discretion', 'immovable_property'],
    proposition:
      'Specific performance is discretionary, not a matter of right. Court considers hardship to defendant, conduct of parties, and whether monetary compensation is adequate relief before granting specific performance of immovable property.',
  },
  {
    caseId: 'curated__n_srinivasa_v_kuttukaran_1998',
    citation: '(1998) 4 SCC 118',
    title: 'N. Srinivasa v. Kuttukaran Machine Tools Ltd.',
    court: 'Supreme Court of India',
    decisionYear: 1998,
    treatmentStatus: 'good_law',
    areas: ['readiness_and_willingness', 'specific_performance'],
    proposition:
      'Plaintiff seeking specific performance must prove readiness and willingness to perform their part of the contract throughout. Mere readiness at the time of suit is insufficient if conduct shows unwillingness.',
  },
  {
    caseId: 'curated__chand_rani_v_kamal_rani_1993',
    citation: '(1993) 1 SCC 519',
    title: 'Smt. Chand Rani v. Kamal Rani',
    court: 'Supreme Court of India',
    decisionYear: 1993,
    treatmentStatus: 'good_law',
    areas: ['limitation', 'specific_performance', 'agreement_to_sell'],
    proposition:
      'Limitation for suit for specific performance runs from the date fixed for performance, or if no date is fixed, from the date when plaintiff has notice that performance is refused.',
  },
  {
    caseId: 'curated__suraj_lamp_v_haryana_2012',
    citation: '(2012) 1 SCC 656',
    title: 'Suraj Lamp & Industries Pvt. Ltd. v. State of Haryana',
    court: 'Supreme Court of India',
    decisionYear: 2012,
    treatmentStatus: 'good_law',
    areas: ['unregistered_agreement', 'title', 'registered_sale_deed'],
    proposition:
      'Sale of immovable property can only be effected by registered conveyance deed, not by GPA/SA/Will transactions. GPA-based transactions confer no title on vendee.',
  },
  {
    caseId: 'curated__saradamani_kandappan_v_rajkumar_2011',
    citation: '(2011) 12 SCC 18',
    title: 'Saradamani Kandappan v. S. Rajalakshmi',
    court: 'Supreme Court of India',
    decisionYear: 2011,
    treatmentStatus: 'good_law',
    areas: ['alternative_compensation', 'specific_performance'],
    proposition:
      'Refund of earnest money/advance with interest is an alternative relief when specific performance is refused. Court may grant compensation under Specific Relief Act when performance is inequitable.',
  },
];

const CONSUMER_CASE_LAW_BANK: CuratedEnrichCase[] = CURATED_CONSUMER_SOURCE_BANK.map((c) => ({
  caseId: c.id,
  citation: c.citation,
  title: c.title,
  court: 'Supreme Court of India',
  treatmentStatus: 'good_law' as const,
  areas: ['deficiency_in_service', 'consumer'],
  proposition: c.summary,
}));

const WRIT_CONSTITUTIONAL_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__maneka_gandhi_v_union_1978',
    citation: 'AIR 1978 SC 597',
    title: 'Maneka Gandhi v. Union of India',
    court: 'Supreme Court of India',
    decisionYear: 1978,
    treatmentStatus: 'good_law',
    areas: ['personal_liberty', 'article_21', 'procedure_established_by_law'],
    proposition:
      'Article 21 protects personal liberty; procedure established by law must be fair, just, and reasonable. Writ jurisdiction is available for violation of fundamental rights.',
  },
  {
    caseId: 'curated__common_cause_v_union_1996',
    citation: '(1996) 4 SCC 33',
    title: 'Common Cause v. Union of India',
    court: 'Supreme Court of India',
    decisionYear: 1996,
    treatmentStatus: 'good_law',
    areas: ['public_interest', 'writ_jurisdiction', 'locus_standi'],
    proposition:
      'High Courts may entertain public interest writs where executive action affects public rights. Locus standi is relaxed in PIL matters.',
  },
];

const ARBITRATION_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__booz_allen_v_sbi_2011',
    citation: '(2011) 5 SCC 532',
    title: 'Booz Allen & Hamilton Inc. v. SBI Home Finance Ltd.',
    court: 'Supreme Court of India',
    decisionYear: 2011,
    treatmentStatus: 'good_law',
    areas: ['arbitration', 'arbitrability', 'section_9'],
    proposition:
      'Courts may grant interim relief under Section 9 of the Arbitration Act when arbitral proceedings are contemplated or pending.',
  },
];

const EMPLOYMENT_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__lakshmi_precision_v_employee_2002',
    citation: '(2002) 2 SCC 333',
    title: 'Lakshmi Precision Screws Ltd. v. Ram Bhagwan',
    court: 'Supreme Court of India',
    decisionYear: 2002,
    treatmentStatus: 'good_law',
    areas: ['wrongful_termination', 'industrial_dispute', 'reinstatement'],
    proposition:
      'Termination without enquiry or violation of principles of natural justice may warrant reinstatement or compensation in industrial disputes.',
  },
];

const TEMP_INJUNCTION_BANK: CuratedEnrichCase[] = [
  {
    caseId: 'curated__dalpat_kumar_v_prahlad_singh_1993',
    citation: '(1993) 1 SCC 719',
    title: 'Dalpat Kumar v. Prahlad Singh',
    court: 'Supreme Court of India',
    decisionYear: 1993,
    treatmentStatus: 'good_law',
    areas: ['temporary_injunction', 'prima_facie_case', 'balance_of_convenience'],
    proposition:
      'Temporary injunction under Order XXXIX Rule 1 CPC requires: (i) prima facie case, (ii) balance of convenience, and (iii) irreparable injury. All three conditions must be satisfied.',
  },
  {
    caseId: 'curated__seema_arora_v_municipal_corp_2010',
    citation: '(2010) 12 SCC 256',
    title: 'Seema Arora v. Municipal Corporation of Greater Mumbai',
    court: 'Supreme Court of India',
    decisionYear: 2010,
    treatmentStatus: 'good_law',
    areas: ['status_quo', 'temporary_injunction'],
    proposition:
      'Status quo order may be granted to preserve subject matter of suit pending adjudication when property is being alienated to third parties.',
  },
];

export function resolveCuratedEnrichBank(
  documentKind: string,
  rawFacts = '',
): CuratedEnrichCase[] {
  const jsonMatches = corpusEnrichCases(documentKind, rawFacts);
  if (jsonMatches.length > 0) return jsonMatches;
  const kind = documentKind.toLowerCase();
  if (/anticipatory/i.test(kind)) return ANTICIPATORY_CASE_LAW_BANK;
  if (/bail/i.test(kind)) return BAIL_CASE_LAW_BANK;
  if (/consumer|medical_negligence/i.test(kind)) return CONSUMER_CASE_LAW_BANK;
  if (/research_memo|case_strategy_memo|legal_research_memo/i.test(kind)) {
    const facts = rawFacts.toLowerCase();
    if (/consumer|medical|deficiency|insurance|repudiat/i.test(facts)) {
      return CONSUMER_CASE_LAW_BANK;
    }
    return [...CONSUMER_CASE_LAW_BANK.slice(0, 2), ...BAIL_CASE_LAW_BANK.slice(0, 1)];
  }
  if (/writ|slp|constitutional/i.test(kind)) return WRIT_CONSTITUTIONAL_BANK;
  if (/arbitration/i.test(kind)) return ARBITRATION_BANK;
  if (/wrongful_termination|employment|labour/i.test(kind)) return EMPLOYMENT_BANK;
  if (/temp_injunction|temporary_injunction|application_temp_injunction/i.test(kind)) {
    return TEMP_INJUNCTION_BANK;
  }
  if (/specific_performance/i.test(kind)) {
    return [...CIVIL_SPECIFIC_PERFORMANCE_BANK, ...TEMP_INJUNCTION_BANK];
  }
  if (/civil_plaint|civil_suit|india_plaint|property_dispute/i.test(kind)) {
    const facts = rawFacts.toLowerCase();
    if (
      /specific\s+performance|agreement\s+to\s+sell|readiness\s+and\s+willingness|sale\s+deed/i.test(
        facts,
      )
    ) {
      return [...CIVIL_SPECIFIC_PERFORMANCE_BANK, ...TEMP_INJUNCTION_BANK];
    }
    return CIVIL_SPECIFIC_PERFORMANCE_BANK.slice(0, 2);
  }
  return [];
}

/** Union of all curated banks — used for identity resolution across domains. */
export function allCuratedEnrichBanks(documentKind = '', rawFacts = ''): CuratedEnrichCase[] {
  const seen = new Set<string>();
  const out: CuratedEnrichCase[] = [];
  const add = (cases: CuratedEnrichCase[]) => {
    for (const c of cases) {
      const key = c.citation.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  };
  add(BAIL_CASE_LAW_BANK);
  add(ANTICIPATORY_CASE_LAW_BANK);
  add(CIVIL_SPECIFIC_PERFORMANCE_BANK);
  add(TEMP_INJUNCTION_BANK);
  add(CONSUMER_CASE_LAW_BANK);
  add(WRIT_CONSTITUTIONAL_BANK);
  add(ARBITRATION_BANK);
  add(EMPLOYMENT_BANK);
  add(resolveCuratedEnrichBank(documentKind, rawFacts));
  add(corpusEnrichCases(documentKind, rawFacts));
  return out;
}
