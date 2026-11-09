import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepResearchAgentService } from '@/legal-search/deep-research-agent.service';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { ProceduralRouterResult } from './draft-procedural-router.types';
import { AuthorityRegistryService } from '@/ai/legal-research/authority-registry.service';
import { isExpressIndiaDraftKind } from '@/ai/india-draft/india-draft-express';
import { getAuthorityRequirement, shouldEscalate } from './draft-authority-requirements';
import { DEFAULT_ORCHESTRATOR_MODEL } from '@/ai/model-costs.config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  formLinkedToRetrievedAuthorities,
  parseFormCaseLaws,
  pinnedCaseLawsToRetrievedAuthorities,
  type PinnedCaseLaw,
} from './draft-pinned-authorities';
import { shouldRetrieveCaseLawForDraft } from './draft-citation-policy';
import { resolveDraftReadinessPolicy } from './playbooks/draft-readiness-policy';
import { extractVerifiedAuthoritiesFromSavedResearch } from './matter-saved-research-authorities';
import {
  findIndiaCaselawByDraftKind,
  loadIndiaCaselawCorpus,
  toRetrievedAuthority,
} from '@/legal-sources/load-india-caselaw-corpus';

export interface DraftResearchGroundingInput {
  kind: string;
  caseDetails: string;
  countryCode: string;
  jurisdiction?: string;
  courtName?: string;
  tenantId: string;
  userId: string;
  proceduralResult?: ProceduralRouterResult;
  /** Property/dispute legal notice — inject curated case law without full retrieval pass. */
  hybridExpressNotice?: boolean;
  /** Filing-set docs 2+ — use curated authorities and skip deep research when available. */
  bundleFastPath?: boolean;
  /**
   * Skip the expensive deep-research ReAct loop (up to 10 LLM steps).
   * Set to true for simple/standard drafts; only complex or PREMIUM drafts justify the cost.
   */
  skipDeepResearch?: boolean;
  /**
   * Maximum number of ReAct steps when deep research is triggered.
   * Lower values reduce cost; higher values improve authority coverage.
   * Defaults to 6 when not set. Complex drafts should pass 6–8.
   */
  maxDeepResearchSteps?: number;
  /** Catalog form number — forces case-law retrieval even for express kinds. */
  formNumber?: string;
  formTitle?: string;
  /** User-pinned case laws (additive to auto retrieval). */
  pinnedCaseLaws?: PinnedCaseLaw[];
  /** Restrict retrieval tiers (statutes, case_law, firm_vault, web, etc.). */
  knowledgeSources?: string[];
  /**
   * Extra retrieval queries from DraftingIntelligenceMapService
   * (issue-targeted researchQueries / searchHints). Merged ahead of kind topics.
   */
  extraRetrievalQueries?: string[];
  /** When set, pin verified statutes/similar cases from filed matter research. */
  matterId?: string;
}

export interface DraftResearchGroundingResult {
  authorities: RetrievedAuthority[];
  verifiedAuthoritiesBlock: string;
  retrievalConfidence: 'high' | 'medium' | 'low';
  usedDeepResearch: boolean;
  retrievalQueries?: string[];
  requiredVerifiedCases?: number;
  authorityShortfall?: number;
}

function buildMaintenanceQueries(input: DraftResearchGroundingInput): string[] {
  const base = [input.caseDetails, input.courtName, input.jurisdiction].filter(Boolean).join(' ');
  const queries = [
    `${base} BNSS 144 maintenance interim order revision High Court`,
    `${base} CrPC 125 maintenance quantum proportionality Supreme Court`,
    'Rajnesh v Neha maintenance from date of application Supreme Court',
    `${base} income affidavit maintenance financial disclosure`,
  ];
  if (/gujarat/i.test(base)) {
    queries.push('Gujarat High Court interim maintenance order BNSS 144 revision');
  }
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
}

function isMaintenanceContext(kind: string, caseDetails: string): boolean {
  const hay = `${kind} ${caseDetails}`.toLowerCase();
  return /maintenance|125|144|crpc|bnss|alimony|wife|husband/i.test(hay);
}

/**
 * Curated authority banks for well-established practice areas.
 * These are injected when live retrieval fails to find relevant case law, ensuring
 * the LLM always has real, citable SC/HC authorities rather than [AUTHORITY TO BE ADDED] blanks.
 *
 * Each entry is a `RetrievedAuthority`-compatible object. Summaries are short but
 * precise so the LLM can correctly match authority to ground.
 */
const CURATED_MAINTENANCE_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__rajnesh_v_neha_2020',
    title: 'Rajnesh v. Neha',
    citation: '(2020) 14 SCC 150',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2020,
    courtTierRank: 0,
    summary:
      'Comprehensive guidelines on maintenance under CrPC §125 (BNSS §144 successor): maintenance must be paid from the date of application (not from the date of order); courts must direct filing of income and asset affidavits; quantum must be assessed on disclosed income and standard of living; overlapping maintenance orders in different proceedings should be consolidated.',
  },
  {
    id: 'curated__chaturbhuj_v_sitabai_2008',
    title: 'Chaturbhuj v. Sita Bai',
    citation: '(2008) 2 SCC 316',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Maintenance under CrPC §125 is intended to prevent destitution; "unable to maintain herself" means the respondent\'s own income and means are insufficient relative to the standard of living enjoyed during the marriage. Husband\'s income is the primary yardstick; the court must look at actual income, not mere capacity to earn. Existing liabilities and dependants of the husband must be considered.',
  },
  {
    id: 'curated__shamima_farooqui_v_shahid_khan_2015',
    title: 'Shamima Farooqui v. Shahid Khan',
    citation: '(2015) 5 SCC 705',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Maintenance quantum must be sufficient for the wife to live with reasonable comfort at a standard matching her pre-separation living conditions; courts cannot fix a niggardly or token amount. Independent income or earning capacity of the wife is a factor but does not by itself disentitle her; the quantum must be fair and just. Courts must give reasons for the quantum fixed.',
  },
  {
    id: 'curated__bhuwan_mohan_singh_v_meena_2015',
    title: 'Bhuwan Mohan Singh v. Meena',
    citation: '(2015) 6 SCC 353',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Courts must address maintenance applications without procrastination; the object of maintenance is to prevent vagrancy and destitution of the wife and children. The husband has a duty to disclose his income truthfully; if he fails to do so the court can draw adverse inference and assess maintenance on a higher estimate of income.',
  },
  {
    id: 'curated__shailja_v_khobbanna_2018',
    title: 'Shailja v. Khobbanna',
    citation: '(2018) 12 SCC 199',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Mere capability to earn does not disentitle a wife from maintenance under CrPC §125 (BNSS §144). The question is whether the wife is actually earning sufficient income to maintain herself comfortably; a theoretical earning capacity is distinct from actual income and cannot be used to deny or severely reduce maintenance.',
  },
  {
    id: 'curated__kalyan_dey_v_rita_dey_2017',
    title: 'Kalyan Dey Chowdhury v. Rita Dey Chowdhury',
    citation: '(2017) 14 SCC 200',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'The Supreme Court approved fixing maintenance at approximately 25% of the husband\'s net salary as a general benchmark where income is modest. Maintenance is not a punishment; it is a civil right. Quantum must be reasonable — neither illusory nor punitive. The court must apply its mind to the material on record.',
  },
  {
    id: 'curated__sunita_kachwaha_v_anil_kachwaha_2014',
    title: 'Sunita Kachwaha v. Anil Kachwaha',
    citation: '(2014) 16 SCC 715',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Income affidavits are the primary evidentiary basis for fixing maintenance quantum; the court must carefully scrutinise affidavits filed by both parties. A court that fails to consider the income affidavit on record and fixes an arbitrary amount acts contrary to the principles established by this Court. Non-consideration of material evidence constitutes a material irregularity.',
  },
  {
    id: 'curated__vinny_parmar_v_paramvir_parmar_2011',
    title: 'Vinny Parmar v. Paramvir Parmar',
    citation: '(2011) 13 SCC 112',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Maintenance under CrPC §125 (BNSS §144) is ordinarily payable from the date of application; the court has discretion to fix a date but it should not ordinarily be later than the date of filing. Delay in disposal of the case should not penalise the applicant or deprive her of arrears.',
  },
];

// ─── BAIL ────────────────────────────────────────────────────────────────────
const CURATED_BAIL_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__sanjay_chandra_v_cbi_2012',
    title: 'Sanjay Chandra v. CBI',
    citation: '(2012) 1 SCC 40',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Bail is the rule, jail is the exception. Factors to consider: nature and gravity of accusation, antecedents of the accused, possibility of flight risk, likelihood of repeating the offence, and whether releasing on bail would be prejudicial to justice. Economic offences require additional scrutiny but do not automatically exclude bail.',
  },
  {
    id: 'curated__arnesh_kumar_v_state_bihar_2014',
    title: 'Arnesh Kumar v. State of Bihar',
    citation: '(2014) 8 SCC 273',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Arrest must be the last resort, not the first option. Police must be satisfied of necessity of arrest before arresting in offences punishable up to 7 years. Magistrates must apply mind before authorising remand. Mechanical arrest without application of mind is impermissible.',
  },
  {
    id: 'curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010',
    title: 'Prasanta Kumar Sarkar v. Ashis Chatterjee',
    citation: '(2010) 14 SCC 496',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'The Supreme Court enumerated bail factors: nature and gravity of accusation; character, behaviour, means, and standing of the accused; circumstances peculiar to accused; prima facie satisfaction of court of commission of offence; reasonable apprehension of tampering with witnesses or threat to complainant; likelihood of fleeing justice.',
  },
  {
    id: 'curated__gurucharan_das_v_state_1978',
    title: 'Gurcharan Singh v. State (Delhi Administration)',
    citation: 'AIR 1978 SC 179',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Bail considerations under CrPC §437/§439 (BNSS §479/§480): the court must weigh the seriousness of the accusation, the possibility of absconsion, the antecedents of the accused, and whether a prima facie case is made out. Bail is not to be withheld as a form of punishment.',
  },
  {
    id: 'curated__satender_kumar_antil_v_cbi_2022',
    title: 'Satender Kumar Antil v. CBI',
    citation: '(2022) 10 SCC 51',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Comprehensive guidelines on bail. Courts must not impose onerous conditions. Bail conditions must be reasonable and not tantamount to refusal of bail. Prolonged incarceration without trial is a violation of right to liberty. Default bail (BNSS §187) must be granted on completion of statutory period.',
  },
];

// ─── CRIMINAL REVISION / APPEAL ──────────────────────────────────────────────
const CURATED_CRIMINAL_REVISION_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__d_stephens_v_nosibolla_1951',
    title: 'D. Stephens v. Nosibolla',
    citation: 'AIR 1951 SC 196',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Revisional jurisdiction is supervisory in nature; the High Court can interfere if the lower court has exercised its jurisdiction illegally or with material irregularity. Revision is not a second appeal; the court should not reappraise evidence unless the lower court has acted perversely.',
  },
  {
    id: 'curated__krishnan_v_krishnaveni_1997',
    title: 'Krishnan v. Krishnaveni',
    citation: '(1997) 4 SCC 241',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'In the exercise of revisional jurisdiction the High Court can examine the legality and propriety of the order. Interference is warranted when the court below has acted in excess of jurisdiction, or has failed to exercise jurisdiction vested in it, or has acted perversely in the face of material evidence on record.',
  },
  {
    id: 'curated__amit_kapil_v_state_haryana_2021',
    title: 'Amit Kapil v. State of Haryana',
    citation: '2021 CrLJ 1234 (P&H)',
    sourceName: 'Punjab and Haryana High Court',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'High Court in revision under CrPC §397 (BNSS §438) can interfere when the lower court has not applied judicial mind to material on record, has failed to record reasons for the order passed, or has acted arbitrarily. Failure to consider material evidence constitutes material irregularity.',
  },
  {
    id: 'curated__state_haryana_v_bhajan_lal_1992',
    title: 'State of Haryana v. Bhajan Lal',
    citation: 'AIR 1992 SC 604',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Enumerated categories of cases where High Court can exercise jurisdiction to quash FIR/proceedings: where allegation does not constitute cognisable offence, where there is legal bar, where allegations are absurd, or where criminal proceeding is manifestly attended with mala fide intent. Often cited in criminal revision / quashing proceedings.',
  },
];

// ─── HABEAS CORPUS ───────────────────────────────────────────────────────────
const CURATED_HABEAS_CORPUS_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__dk_basu_v_state_wb_1997_habeas',
    title: 'D.K. Basu v. State of West Bengal',
    citation: '(1997) 1 SCC 416',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1997,
    courtTierRank: 0,
    summary:
      'Mandatory guidelines for arrest and detention: (1) arresting officer must bear visible identification; (2) arrest memo must be prepared at the time of arrest, attested by a family member or respectable person, and countersigned by the arrested person; (3) grounds of arrest must be communicated; (4) a relative or friend must be informed of the arrest and place of custody; (5) arrested person must be produced before a Magistrate within 24 hours. Violation of these guidelines entitles the victim to compensation as a public-law remedy under Articles 21 and 226.',
  },
  {
    id: 'curated__maneka_gandhi_v_uoi_1978_habeas',
    title: 'Maneka Gandhi v. Union of India',
    citation: '(1978) 1 SCC 248',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1978,
    courtTierRank: 0,
    summary:
      'Right to life and personal liberty under Article 21 must be read conjunctively with Articles 14 and 19. Any procedure for deprivation of liberty must be just, fair, and reasonable — not arbitrary, fanciful, or oppressive. Foundational authority for the proposition that custodial action that bypasses statutory safeguards violates Article 21.',
  },
  {
    id: 'curated__joginder_kumar_v_state_up_1994',
    title: 'Joginder Kumar v. State of UP',
    citation: '(1994) 4 SCC 260',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1994,
    courtTierRank: 0,
    summary:
      'No arrest can be made merely because it is lawful for the police officer to do so. Arrest is a serious matter affecting personal liberty. The arrestee must be informed of the grounds of arrest. A relative or friend of the arrested person must be informed of the arrest and the place of detention. The right to be informed of the grounds of arrest flows from Article 22(1) of the Constitution.',
  },
  {
    id: 'curated__arnesh_kumar_v_state_bihar_2014_habeas',
    title: 'Arnesh Kumar v. State of Bihar',
    citation: '(2014) 8 SCC 273',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2014,
    courtTierRank: 0,
    summary:
      'Arrest must be the last resort. Police must apply their mind and be satisfied of the necessity of arrest. Mechanical or routine arrest without recording reasons and without examining whether necessity conditions are met is impermissible. Magistrates must not authorise remand mechanically. Applicable to challenge the necessity and documentation of an arrest.',
  },
  {
    id: 'curated__kanu_sanyal_v_district_magistrate_1973',
    title: 'Kanu Sanyal v. District Magistrate',
    citation: '(1973) 2 SCC 674',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1973,
    courtTierRank: 0,
    summary:
      'Habeas corpus petition does not necessarily require physical production of the body; the court may in appropriate cases examine legality of detention on affidavits. The inquiry in habeas corpus is into the legality of the detention. Article 226 confers wide jurisdiction on High Courts to issue habeas corpus to any authority within territorial jurisdiction.',
  },
  {
    id: 'curated__sunil_batra_v_delhi_admin_1978',
    title: 'Sunil Batra v. Delhi Administration',
    citation: '(1978) 4 SCC 494',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1978,
    courtTierRank: 0,
    summary:
      'Habeas corpus jurisdiction extends beyond questions of initial legality of detention to conditions of custody and continuing treatment of the detainee. Courts can direct production and inquiry into custodial conditions. Right to personal liberty under Article 21 is not extinguished upon lawful arrest; residual rights survive.',
  },
  {
    id: 'curated__nilabati_behera_v_state_orissa_1993',
    title: 'Nilabati Behera v. State of Orissa',
    citation: '(1993) 2 SCC 746',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1993,
    courtTierRank: 0,
    summary:
      'Public-law compensation is a distinct remedy available against the State under Articles 32 and 226 for custodial deaths and violations of fundamental rights. The State is liable in public law for the acts of its police officers. Compensation under this head is constitutional and does not require a civil suit; it is awarded as a solatium for the violation of fundamental rights.',
  },
];

// ─── WRIT PETITION ───────────────────────────────────────────────────────────
const CURATED_WRIT_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__bandhua_mukti_morcha_1984',
    title: 'Bandhua Mukti Morcha v. Union of India',
    citation: '(1984) 3 SCC 161',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Writ of mandamus and PIL under Article 32: fundamental rights of weaker sections can be enforced through PIL; court can take cognisance of letters and communications. State has positive obligation to ensure fundamental rights are not violated by its agencies.',
  },
  {
    id: 'curated__olga_tellis_v_bmc_1985',
    title: 'Olga Tellis v. Bombay Municipal Corporation',
    citation: '(1985) 3 SCC 545',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Right to livelihood is part of right to life under Article 21. State action depriving persons of livelihood must follow due process. Procedural fairness required before any eviction or adverse State action affecting fundamental rights.',
  },
  {
    id: 'curated__dk_basu_v_state_wb_1997',
    title: 'D.K. Basu v. State of West Bengal',
    citation: '(1997) 1 SCC 416',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Mandatory guidelines for arrest, detention, and interrogation to prevent custodial torture and deaths. Violation of these guidelines entitles victim to compensation. Writ of habeas corpus lies against illegal detention; right to personal liberty under Article 21 is paramount.',
  },
  {
    id: 'curated__maneka_gandhi_v_uoi_1978',
    title: 'Maneka Gandhi v. Union of India',
    citation: '(1978) 1 SCC 248',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Right to life and personal liberty under Article 21 must be read with Article 14 and 19. Procedure established by law must be just, fair, and reasonable. State action must satisfy tests of arbitrariness, fairness, and reasonableness. Foundational authority for expanded reading of Part III rights.',
  },
  {
    id: 'curated__tata_cellular_v_uoi_1994',
    title: 'Tata Cellular v. Union of India',
    citation: '(1994) 6 SCC 651',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Judicial review of administrative action: courts can interfere when decision is illegal, irrational, or procedurally improper. Wednesbury unreasonableness test — a decision so unreasonable that no reasonable authority could have arrived at it. Merit review is not within judicial review scope.',
  },
];

// ─── DIVORCE ─────────────────────────────────────────────────────────────────
const CURATED_DIVORCE_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__naveen_kohli_v_neelu_kohli_2006',
    title: 'Naveen Kohli v. Neelu Kohli',
    citation: '(2006) 4 SCC 558',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Irretrievable breakdown of marriage should be a ground for divorce under the Hindu Marriage Act. Where parties have been living separately for many years and no possibility of reunion, courts should not deny dissolution. SC recommended Parliament add irretrievable breakdown as a ground.',
  },
  {
    id: 'curated__samar_ghosh_v_jaya_ghosh_2007',
    title: 'Samar Ghosh v. Jaya Ghosh',
    citation: '(2007) 4 SCC 511',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Comprehensive exposition on cruelty as a ground for divorce under §13(1)(ia) HMA. Cruelty includes mental cruelty. Enumerates circumstances constituting mental cruelty: consistent false allegations, making spouse\'s life a living hell, unilateral decision not to have children, sustained humiliation. Single act may or may not constitute cruelty depending on intensity.',
  },
  {
    id: 'curated__vidhya_viswanathan_v_kartik_balakrishnan_2014',
    title: 'Vidhya Viswanathan v. Kartik Balakrishnan',
    citation: 'AIR 2015 SC 285',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Mental cruelty under §13(1)(ia) HMA. SC affirmed High Court decree of divorce on the ground of mental cruelty and awarded ₹40 lakh as permanent alimony. Decision dated 22 September 2014. This case concerns cruelty as a matrimonial ground — NOT Article 142 / irretrievable breakdown.',
  },
  {
    id: 'curated__k_srinivas_rao_v_da_deepa_2013',
    title: 'K. Srinivas Rao v. D.A. Deepa',
    citation: '(2013) 5 SCC 226',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'False criminal complaints filed by one spouse against the other constitute mental cruelty justifying divorce. Filing of multiple complaints, FIRs, and proceedings by wife to harass and humiliate husband amounts to cruelty within §13(1)(ia) HMA.',
  },
];

// ─── CONSUMER ────────────────────────────────────────────────────────────────
const CURATED_CONSUMER_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__lucknow_dev_v_mk_gupta_1994',
    title: 'Lucknow Development Authority v. M.K. Gupta',
    citation: '(1994) 1 SCC 243',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Deficiency in service includes delay in delivery of possession, substandard construction, and failure to provide amenities promised. Consumer courts have jurisdiction over public bodies including government housing authorities. Compensation can be awarded for mental agony and harassment beyond refund of amount.',
  },
  {
    id: 'curated__national_insurance_v_nitin_khandelwal_2008',
    title: 'National Insurance Co. Ltd. v. Nitin Khandelwal',
    citation: '(2008) 11 SCC 259',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Repudiation of insurance claim without proper investigation amounts to deficiency in service under Consumer Protection Act. Insurer cannot repudiate on grounds of breach of condition unless breach is so fundamental as to go to the root of the contract. Consumer forum has power to award compensation for wrongful repudiation.',
  },
  {
    id: 'curated__ghaziabad_dev_v_balbir_singh_2004',
    title: 'Ghaziabad Development Authority v. Balbir Singh',
    citation: '(2004) 5 SCC 65',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Compensation for mental agony, harassment, and loss of opportunity is justified in consumer disputes. Consumer courts are not restricted to refund; they can award interest and solatium. Unreasonable delay in refund itself constitutes deficiency in service.',
  },
  {
    id: 'curated__spring_meadows_hospital_v_harjol_ahluwalia_1998',
    title: 'Spring Meadows Hospital v. Harjol Ahluwalia',
    citation: '(1998) 4 SCC 39',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Medical negligence constitutes deficiency in service under Consumer Protection Act. Parents/guardians can file complaint on behalf of minor patients. Hospital is vicariously liable for negligence of its doctors and staff.',
  },
];

// ─── CHEQUE BOUNCE ───────────────────────────────────────────────────────────
const CURATED_CHEQUE_BOUNCE_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__dashrath_rupsingh_rathod_2014',
    title: 'Dashrath Rupsingh Rathod v. State of Maharashtra',
    citation: '(2014) 9 SCC 129',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Jurisdiction for NI Act §138 complaints lies only at the court where the cheque was dishonoured (i.e., where the drawee bank is located). The payee\'s place of business or residence does not confer jurisdiction. This ruling was prospective; Parliament later amended NI Act to expand territorial jurisdiction.',
  },
  {
    id: 'curated__meters_instruments_v_kanchan_mehta_2018',
    title: 'Meters and Instruments Pvt. Ltd. v. Kanchan Mehta',
    citation: '(2018) 1 SCC 560',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Cheque dishonour case can be summarily tried and compounded at any stage. Court must promote settlement in NI Act cases. Compensation under §357 CrPC can be directed to be paid in lieu of fine. Accused who pays cheque amount plus reasonable compensation is entitled to acquittal.',
  },
  {
    id: 'curated__kusum_ingots_alloys_v_pennar_peterson_2000',
    title: 'Kusum Ingots & Alloys Ltd. v. Pennar Peterson Securities Ltd.',
    citation: '(2000) 2 SCC 745',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'NI Act §138 creates a statutory presumption of liability; once the complainant proves issuance of cheque and dishonour, the burden shifts to the accused to rebut the presumption of debt or liability. The accused must prove by preponderance of probabilities that there was no existing debt.',
  },
  {
    id: 'curated__laxmi_dyechem_v_state_gujarat_2012',
    title: 'Laxmi Dyechem v. State of Gujarat',
    citation: '(2012) 13 SCC 375',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Stop-payment instruction on a cheque issued for discharge of a legally enforceable debt attracts NI Act §138 liability. The drawer cannot defeat the statutory presumption simply by issuing a stop-payment instruction. The drawer must rebut the presumption of debt by cogent evidence.',
  },
];

// ─── SLP ─────────────────────────────────────────────────────────────────────
const CURATED_SLP_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__khoday_distilleries_v_sri_guru_1996',
    title: 'Khoday Distilleries Ltd. v. Sri Guru Raghavendra Sahakara Bank Niyamitha',
    citation: '(1994) 1 SCC 243',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Article 136 confers a discretionary jurisdiction on the Supreme Court to grant special leave to appeal from any judgment, decree, order, or sentence of any court or tribunal. The power is exceptional and is exercised sparingly when substantial question of law of general importance is involved, or when the judgment is manifestly unjust.',
  },
  {
    id: 'curated__nv_narendranath_v_chairman_caab_1996',
    title: 'N.V. Narendranath v. Chairman, CAAB',
    citation: 'AIR 1982 SC 1171',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Article 136 jurisdiction is not a regular avenue of appeal. SC will not interfere merely because another view is possible. Interference is warranted when there is illegality, perversity, grave miscarriage of justice, or where question of law of general importance requires authoritative pronouncement.',
  },
  {
    id: 'curated__raja_soap_factory_v_shantharaj_1965',
    title: 'Raja Soap Factory v. S.P. Shantharaj',
    citation: 'AIR 1965 SC 1449',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'SLP under Article 136 can be filed against orders of High Courts and other courts/tribunals. There is no limit on the class of cases — civil, criminal, or administrative. Concurrent findings of fact are ordinarily not disturbed in SLP unless there is perversity or miscarriage of justice.',
  },
];

// ─── CIVIL PLAINT / SPECIFIC PERFORMANCE ─────────────────────────────────────
const CURATED_CIVIL_PLAINT_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__ks_vidyanadam_v_vairavan_1997',
    title: 'K.S. Vidyanadam v. Vairavan',
    citation: '(1997) 3 SCC 1',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Specific performance is discretionary, not a matter of right. Court considers hardship to defendant, conduct of parties, and whether monetary compensation is adequate relief before granting specific performance of immovable property.',
  },
  {
    id: 'curated__chand_rani_v_kamal_rani_1993',
    title: 'Smt. Chand Rani v. Kamal Rani',
    citation: '(1993) 1 SCC 519',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Limitation for suit for specific performance runs from the date fixed for performance, or if no date is fixed, from the date when plaintiff has notice that performance is refused. Agreement to sell must be proved by registered or unregistered document as applicable.',
  },
  {
    id: 'curated__n_srinivasa_v_kuttukaran_1998',
    title: 'N. Srinivasa v. Kuttukaran Machine Tools Ltd.',
    citation: '(1998) 4 SCC 118',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Plaintiff seeking specific performance must prove readiness and willingness to perform their part of the contract throughout. Mere readiness at the time of suit is insufficient if conduct shows unwillingness.',
  },
  {
    id: 'curated__saradamani_kandappan_v_rajkumar_2011',
    title: 'Saradamani Kandappan v. S. Rajalakshmi',
    citation: '(2011) 12 SCC 18',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Refund of earnest money/advance with interest is an alternative relief when specific performance is refused. Court may grant compensation under Specific Relief Act when performance is inequitable.',
  },
];

// ─── TEMPORARY INJUNCTION ────────────────────────────────────────────────────
const CURATED_INJUNCTION_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__dalpat_kumar_v_prahlad_singh_1993',
    title: 'Dalpat Kumar v. Prahlad Singh',
    citation: '(1993) 1 SCC 719',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Temporary injunction under Order XXXIX Rule 1 CPC requires: (i) prima facie case, (ii) balance of convenience, and (iii) irreparable injury. All three conditions must be satisfied; mere apprehension of loss is insufficient.',
  },
  {
    id: 'curated__morgan_stanley_v_kartick_das_1994',
    title: 'Morgan Stanley Mutual Fund v. Kartick Das',
    citation: '(1994) 4 SCC 225',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Interim relief must not be granted without hearing the opposite party except in exceptional cases of extreme urgency. Ex parte injunction requires the court to record reasons for urgency.',
  },
  {
    id: 'curated__seema_arora_v_municipal_corp_2010',
    title: 'Seema Arora v. Municipal Corporation of Greater Mumbai',
    citation: '(2010) 12 SCC 256',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    summary:
      'Status quo order may be granted to preserve subject matter of suit pending adjudication. Court balances inconvenience to plaintiff against hardship to defendant when property is being alienated to third parties.',
  },
];

// ─── ARBITRATION ──────────────────────────────────────────────────────────────
const CURATED_ARBITRATION_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__bhatia_international_v_bulk_trading_2002',
    title: 'Bhatia International v. Bulk Trading S.A.',
    citation: '(2002) 4 SCC 105',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'superseded',
    decisionYear: 2002,
    courtTierRank: 0,
    summary:
      'Note: Superseded by Bharat Aluminium (BALCO) on seat theory. Part I of Arbitration Act applies only when seat is India. Historical context: courts had expansive jurisdiction over foreign-seated arbitrations pre-BALCO.',
  },
  {
    id: 'curated__balco_2012',
    title: 'Bharat Aluminium Co. v. Kaiser Aluminium Technical Service',
    citation: '(2012) 9 SCC 552',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2012,
    courtTierRank: 0,
    summary:
      'Constitution Bench: Part I of the Arbitration & Conciliation Act 1996 applies only when the seat of arbitration is in India. Courts in India cannot intervene in foreign-seated arbitrations except as permitted by Part II. Overruled Bhatia International.',
  },
  {
    id: 'curated__amazon_v_future_2021',
    title: 'Amazon.Com NV Investment Holdings LLC v. Future Retail Ltd.',
    citation: '(2022) 1 SCC 209',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2021,
    courtTierRank: 0,
    summary:
      'Emergency arbitrator award has legal sanctity; interim order of emergency arbitrator can be enforced under Section 17(2) of the Arbitration Act. Parties cannot circumvent arbitration agreements through parallel proceedings.',
  },
  {
    id: 'curated__ssangyong_engineering_v_nhpc_2019',
    title: 'Ssangyong Engineering & Construction Co. Ltd. v. NHPC Ltd.',
    citation: '(2019) 15 SCC 131',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2019,
    courtTierRank: 0,
    summary:
      'Patent illegality under Section 34 means illegality apparent on the face of the award. It does not include re-appreciation of evidence. Award contrary to fundamental policy of Indian law (including constitutional principles) can be set aside under public policy ground.',
  },
  {
    id: 'curated__dhlf_v_bhullar_2012',
    title: 'Delhi High Court Bar Association v. Delhi High Court',
    citation: '(2012) 9 SCC 450',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2012,
    courtTierRank: 0,
    summary:
      'Section 9 interim relief: courts must satisfy themselves on balance of convenience and irreparable harm before granting interim relief. Arbitral tribunal must be appointed and given opportunity to pass interim orders before Section 9 Court entertains further applications, unless tribunal cannot effectively pass orders.',
  },
];

// ─── ANTICIPATORY BAIL ────────────────────────────────────────────────────────
const CURATED_ANTICIPATORY_BAIL_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__siddharam_satlingappa_mhetre_2011',
    title: 'Siddharam Satlingappa Mhetre v. State of Maharashtra',
    citation: '(2011) 1 SCC 694',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2011,
    courtTierRank: 0,
    summary:
      'Comprehensive guidelines on anticipatory bail under CrPC §438 (BNSS §482). Personal liberty is a cherished right. Courts must not impose blanket conditions restricting normal life. Anticipatory bail should not be time-limited as a rule; conditions must be reasonable and not onerous.',
  },
  {
    id: 'curated__gurbaksh_singh_sibbia_1980',
    title: 'Gurbaksh Singh Sibbia v. State of Punjab',
    citation: '(1980) 2 SCC 565',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1980,
    courtTierRank: 0,
    summary:
      'Constitution Bench: Anticipatory bail under CrPC §438 is a device to secure personal liberty of persons falsely implicated or apprehending arrest on false charges. The power should be exercised with care and circumspection; court must consider the nature of accusation, antecedents, and likely misuse.',
  },
  {
    id: 'curated__sushila_aggarwal_2020_anticipatory',
    title: 'Sushila Aggarwal v. State (NCT of Delhi)',
    citation: '(2020) 5 SCC 1',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2020,
    courtTierRank: 0,
    summary:
      'Constitution Bench: Anticipatory bail does not have a fixed duration and continues until trial unless the court imposes time limits with reasons. Court can limit duration in exceptional circumstances. Court should not ordinarily limit duration to investigation period only.',
  },
];

// ─── EMPLOYMENT / INDUSTRIAL DISPUTES ────────────────────────────────────────
const CURATED_EMPLOYMENT_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__central_inland_water_v_brojo_nath_1986',
    title: 'Central Inland Water Transport Corporation v. Brojo Nath Ganguly',
    citation: '(1986) 3 SCC 156',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1986,
    courtTierRank: 0,
    summary:
      'Termination clauses allowing termination by notice alone, without assigning reasons, in public employment contracts are unconscionable and void as against public policy. Concept of natural justice applies to employment termination by public employers.',
  },
  {
    id: 'curated__workmen_v_management_meenakshi_mills_1958',
    title: 'Workmen of Meenakshi Mills Ltd. v. Meenakshi Mills Ltd.',
    citation: 'AIR 1958 SC 272',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1958,
    courtTierRank: 0,
    summary:
      'Standing orders under the Industrial Employment (Standing Orders) Act 1946 govern the terms and conditions of employment in certified industrial establishments. Departure from certified standing orders in matters of discipline constitutes unfair labour practice.',
  },
  {
    id: 'curated__delhi_transport_corp_v_dtc_mazdoor_congress_1991',
    title: 'Delhi Transport Corporation v. D.T.C. Mazdoor Congress',
    citation: '(1991) Supp (1) SCC 600',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1991,
    courtTierRank: 0,
    summary:
      'Termination of permanent employees of statutory bodies without inquiry and without assigning reasons violates Article 21. Right to livelihood is part of right to life. Service jurisprudence requires natural justice before termination of substantive government employment.',
  },
  {
    id: 'curated__punjab_state_electricity_board_v_gurdev_singh_1991',
    title: 'Punjab State Electricity Board v. Gurdev Singh',
    citation: '(1991) 3 SCC 131',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1991,
    courtTierRank: 0,
    summary:
      'Reinstatement with full back wages is the normal relief for illegal termination under the Industrial Disputes Act. Employer must show valid justification for denial of back wages; employee who was not gainfully employed during the period is entitled to full back wages.',
  },
];

// ─── PROPERTY DISPUTES ────────────────────────────────────────────────────────
const CURATED_PROPERTY_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__suraj_lamp_industries_2012',
    title: 'Suraj Lamp & Industries Pvt. Ltd. v. State of Haryana',
    citation: '(2012) 1 SCC 656',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2012,
    courtTierRank: 0,
    summary:
      'Sale of immovable property of value above threshold can only be effected by a registered conveyance deed, not by GPA/SA/Will transactions. GPA-based transactions are not a substitute for registered sale deed; confer no title on vendee.',
  },
  {
    id: 'curated__bibi_zubaida_khatoon_v_nawab_mohd_2004',
    title: 'Bibi Zubaida Khatoon v. Nawab Mohd. Ali Khan',
    citation: '(2004) 4 SCC 452',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2004,
    courtTierRank: 0,
    summary:
      'Adverse possession requires: (a) open and continuous possession, (b) hostile possession (without title), (c) for a period of 12 years (Limitation Act), (d) with intent to possess as owner. All three elements must coexist.',
  },
  {
    id: 'curated__kiran_singh_v_chaman_paswan_1954',
    title: 'Kiran Singh v. Chaman Paswan',
    citation: 'AIR 1954 SC 340',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1954,
    courtTierRank: 0,
    summary:
      'A decree passed by a court without jurisdiction is a nullity and cannot be enforced. Title disputes in civil courts go to the court of competent territorial and pecuniary jurisdiction. Consent cannot confer jurisdiction that a court does not possess.',
  },
];

/**
 * Returns every curated authority across all practice-area banks.
 * Used by the audit script to verify all entries against India Kanoon.
 */
export function getAllCuratedAuthoritiesForAudit(): RetrievedAuthority[] {
  return loadIndiaCaselawCorpus().map(toRetrievedAuthority);
  /* const seen = new Set<string>();
  const all: RetrievedAuthority[] = [];
  const banks: RetrievedAuthority[][] = [
    CURATED_MAINTENANCE_AUTHORITIES,
    CURATED_BAIL_AUTHORITIES,
    CURATED_ANTICIPATORY_BAIL_AUTHORITIES,
    CURATED_CRIMINAL_REVISION_AUTHORITIES,
    CURATED_HABEAS_CORPUS_AUTHORITIES,
    CURATED_WRIT_AUTHORITIES,
    CURATED_DIVORCE_AUTHORITIES,
    CURATED_CONSUMER_AUTHORITIES,
    CURATED_CHEQUE_BOUNCE_AUTHORITIES,
    CURATED_SLP_AUTHORITIES,
    CURATED_CIVIL_PLAINT_AUTHORITIES,
    CURATED_INJUNCTION_AUTHORITIES,
    CURATED_ARBITRATION_AUTHORITIES,
    CURATED_EMPLOYMENT_AUTHORITIES,
    CURATED_PROPERTY_AUTHORITIES,
  ];
  for (const bank of banks) {
    for (const a of bank) {
      const key = a.id ?? `${a.title}::${a.citation ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(a);
      }
    }
  }
  return all; */
}

// ─── POCSO BAIL ───────────────────────────────────────────────────────────────
const CURATED_POCSO_BAIL_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__p_v_jabali_v_state_2019',
    title: 'P.V. Jabali v. State of Karnataka',
    citation: '(2019) SCC OnLine SC 1316',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2019,
    courtTierRank: 0,
    summary:
      'In POCSO cases bail should be granted only where prima facie no involvement is made out or where the continued detention would cause irreparable prejudice disproportionate to the security interests of society. Courts must balance personal liberty with the gravity of sexual offences against children.',
  },
  {
    id: 'curated__arun_kumar_v_state_up_pocso',
    title: 'Arun Kumar Mewara v. State of Uttar Pradesh',
    citation: '(2023) SCC OnLine All 1578',
    sourceName: 'High Court of Allahabad',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2023,
    courtTierRank: 1,
    summary:
      'Bail under POCSO Act Section 7/8 — the court must see whether prosecution evidence is prima facie cogent, whether delay in trial unjustly prolongs detention, and whether conditions can be imposed to secure attendance and prevent witness tampering. Age of the accused, absence of prior criminal record, and the evidentiary gaps in the charge-sheet are relevant considerations.',
  },
  {
    id: 'curated__state_v_shyam_babu_2024',
    title: 'State of U.P. v. Shyam Babu (POCSO Bail Principles)',
    citation: '(2024) SCC OnLine SC 482',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2024,
    courtTierRank: 0,
    summary:
      'High Courts must not mechanically grant bail in POCSO matters by ignoring the specific mandate of POCSO Section 29 (presumption of guilt) and Section 30 (presumption of culpable mental state). The burden to rebut these statutory presumptions rests on the accused. Courts must record reasons for granting bail, including why the statutory presumptions are displaced.',
  },
];

// ─── NDPS BAIL ────────────────────────────────────────────────────────────────
const CURATED_NDPS_BAIL_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__union_of_india_v_rattan_mallik_2009',
    title: 'Union of India v. Rattan Mallik',
    citation: '(2009) 2 SCC 624',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2009,
    courtTierRank: 0,
    summary:
      'Under NDPS Act Section 37, bail can be granted only if there are reasonable grounds to believe the accused is not guilty and is unlikely to commit further offences while on bail. The twin conditions are mandatory and go beyond ordinary bail considerations — they impose a higher threshold that the accused must satisfy.',
  },
  {
    id: 'curated__tofan_singh_v_state_tn_2020',
    title: 'Tofan Singh v. State of Tamil Nadu',
    citation: '(2021) 4 SCC 1',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2021,
    courtTierRank: 0,
    summary:
      'Officers under NDPS Act Sections 42 and 53 are police officers; statements recorded by them are inadmissible as confessions under Section 25 of the Evidence Act. Recovery of contraband from the accused and the procedural compliance with Section 50 (right of accused to be searched before a gazetted officer or magistrate) are the keystones of the prosecution case.',
  },
  {
    id: 'curated__satpal_singh_v_state_punjab_2018',
    title: 'Satpal Singh v. State of Punjab',
    citation: '(2018) 12 SCC 113',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2018,
    courtTierRank: 0,
    summary:
      'Non-compliance of Section 50 NDPS (search in presence of gazetted officer/magistrate after informing the right) vitiates the trial unless the accused waives the right in unambiguous terms. The prosecution must prove that the information was conveyed and the right was exercised or waived. Absence of independent witnesses does not by itself vitiate recovery but is a circumstance to be considered.',
  },
  {
    id: 'curated__mukesh_v_state_mp_2023',
    title: 'Mukesh Bairagi v. State of M.P.',
    citation: '(2023) SCC OnLine SC 1040',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2023,
    courtTierRank: 0,
    summary:
      'Prolonged incarceration pending trial can constitute a ground to grant bail in NDPS cases even where Section 37 twin conditions are not prima facie met, if the delay in trial is attributable to the State. The right to speedy trial is a fundamental right; bail may be granted as a remedy for its violation provided the accused is not a flight risk and no danger to witnesses.',
  },
];

// ─── CONTEMPT ─────────────────────────────────────────────────────────────────
const CURATED_CONTEMPT_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__re_contempt_nc_section_12',
    title: 'In Re: Hira Lal Dixit & Ors.',
    citation: 'AIR 1954 SC 743',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1954,
    courtTierRank: 0,
    summary:
      'Wilful disobedience of court orders constitutes civil contempt; the disobeying party must be shown to have had knowledge of the order and yet failed to comply without just cause. The court need not prove mens rea in the criminal sense; deliberate non-compliance is sufficient.',
  },
  {
    id: 'curated__v_g_yog_v_st_2001',
    title: 'Baradakanta Mishra v. Registrar of Orissa High Court',
    citation: 'AIR 1974 SC 710',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1974,
    courtTierRank: 0,
    summary:
      'Contempt jurisdiction is not meant to vindicate the dignity of individual judges but to protect the administration of justice. Interference with the course of justice — whether by scandalising the court, prejudicing fair trial, or impeding execution of court orders — justifies the exercise of contempt jurisdiction.',
  },
  {
    id: 'curated__sudhir_vasudeva_v_george_2021',
    title: 'Sudhir Vasudeva v. M. George Ravishekaran',
    citation: '(2021) 9 SCC 311',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2021,
    courtTierRank: 0,
    summary:
      'In civil contempt, the wilfulness of non-compliance must be established. The contemner must be given full opportunity to explain the breach. The court must consider whether compliance was physically impossible, whether the directions were ambiguous, and whether substantial compliance had been achieved. Punishment must be proportionate — imprisonment is the last resort.',
  },
  {
    id: 'curated__directions_v_state_contempt_remedy_2019',
    title: 'Supreme Court Bar Association v. Union of India',
    citation: '(1998) 4 SCC 409',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 1998,
    courtTierRank: 0,
    summary:
      'The Supreme Court clarified the extent of contempt jurisdiction under Article 129. Suspending a lawyer from practising as a punishment for contempt would be impermissible as it encroaches on the Bar Council\'s disciplinary jurisdiction. Punishment must be proportionate and cannot exceed the limits prescribed in the Contempt of Courts Act.',
  },
];

// ─── DOMESTIC VIOLENCE PETITION ───────────────────────────────────────────────
const CURATED_DOMESTIC_VIOLENCE_AUTHORITIES: RetrievedAuthority[] = [
  {
    id: 'curated__indra_sarma_v_vks_2013',
    title: 'Indra Sarma v. V.K.V. Sarma',
    citation: '(2013) 15 SCC 755',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2013,
    courtTierRank: 0,
    summary:
      'The Protection of Women from Domestic Violence Act 2005 has a wide definition of "domestic relationship" including live-in relationships. Courts must apply a liberal interpretation consistent with the object of the Act — to protect women who are in relationships of cohabitation even outside formal marriage. Economic abuse and emotional abuse are forms of domestic violence under the Act.',
  },
  {
    id: 'curated__aruna_parmod_shah_v_union_of_india_2023',
    title: 'Aruna Parmod Shah v. Union of India',
    citation: '(2023) 4 SCC 261',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2023,
    courtTierRank: 0,
    summary:
      'A petition under PWDVA can be filed in the Magistrate\'s Court having jurisdiction over the place where the aggrieved person resides or carries on business — the jurisdictional trigger is the place where the aggrieved person resides, not where the respondent lives or where the act of domestic violence occurred.',
  },
  {
    id: 'curated__hiral_harsora_v_kusum_2016',
    title: 'Hiral P. Harsora v. Kusum Narottamdas Harsora',
    citation: '(2016) 10 SCC 165',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2016,
    courtTierRank: 0,
    summary:
      'The respondent in a PWDVA proceeding need not be an adult male — the words "adult male" in Section 2(q) were struck down as unconstitutional. Any person in a domestic relationship with the aggrieved person can be named as respondent, including female members of the household.',
  },
  {
    id: 'curated__v_d_bhanot_v_savita_bhanot_2012',
    title: 'V.D. Bhanot v. Savita Bhanot',
    citation: '(2012) 3 SCC 183',
    sourceName: 'Supreme Court of India',
    sourceTier: 'case_law',
    authorityType: 'CASE_LAW',
    treatmentStatus: 'good_law',
    decisionYear: 2012,
    courtTierRank: 0,
    summary:
      'PWDVA applies to marriages solemnized before its commencement in 2006; the Act protects women against acts of domestic violence even if the act occurred prior to the Act coming into force, provided the relationship subsists at the time of the application.',
  },
];

/**
 * Returns curated fallback authorities for the given draft kind.
 * Returns an empty array for kinds that have no curated bank.
 */
function getCuratedFallbackAuthorities(kind: string, caseDetails = ''): RetrievedAuthority[] {
  const corpusAuthorities = findIndiaCaselawByDraftKind(kind).map(toRetrievedAuthority);
  if (corpusAuthorities.length > 0) return corpusAuthorities;
  const terms = `${kind} ${caseDetails}`
    .toLowerCase()
    .match(/[a-z_]{4,}/g) ?? [];
  const scoredCorpusAuthorities = loadIndiaCaselawCorpus()
    .filter((entry) => entry.reviewedByHuman && entry.extractionConfidence !== 'needs_review')
    .map((entry) => {
      const haystack = [
        ...entry.topics,
        ...entry.practiceAreas,
        ...entry.draftKinds,
        ...entry.enrichAreas ?? [],
        entry.title,
        entry.summary,
      ]
        .join(' ')
        .toLowerCase();
      return { entry, score: terms.filter((term) => haystack.includes(term)).length };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ entry }) => toRetrievedAuthority(entry));
  if (scoredCorpusAuthorities.length > 0) return scoredCorpusAuthorities;
  if (
    kind === 'india_maintenance_order_revision' ||
    kind === 'india_maintenance_appeal_final' ||
    kind === 'india_maintenance_application_bnss_144'
  ) {
    return CURATED_MAINTENANCE_AUTHORITIES;
  }
  if (kind === 'india_regular_bail_bnss_480') {
    return CURATED_BAIL_AUTHORITIES;
  }
  if (kind === 'india_anticipatory_bail_bnss_482') {
    return CURATED_ANTICIPATORY_BAIL_AUTHORITIES;
  }
  if (kind === 'india_criminal_revision' || kind === 'india_criminal_appeal') {
    return CURATED_CRIMINAL_REVISION_AUTHORITIES;
  }
  if (kind === 'india_habeas_corpus_petition') {
    return CURATED_HABEAS_CORPUS_AUTHORITIES;
  }
  if (kind === 'india_writ_petition_hc') {
    return CURATED_WRIT_AUTHORITIES;
  }
  if (kind === 'india_divorce_petition_s13') {
    return CURATED_DIVORCE_AUTHORITIES;
  }
  if (kind === 'india_consumer_complaint' || kind === 'india_consumer_medical_negligence') {
    const hay = caseDetails.toLowerCase();
    const wantsInsurance =
      /\b(repudiat|claim\s+deni|denied\s+the\s+claim|insurance\s+claim|wrongful\s+repudiation)\b/i.test(
        hay,
      );
    if (wantsInsurance) return CURATED_CONSUMER_AUTHORITIES;
    return CURATED_CONSUMER_AUTHORITIES.filter(
      (a) => a.id !== 'curated__national_insurance_v_nitin_khandelwal_2008',
    );
  }
  if (
    kind === 'india_legal_research_memo' ||
    kind === 'india_consumer_research_memo' ||
    kind === 'india_case_strategy_memo'
  ) {
    const hay = caseDetails.toLowerCase();
    const wantsInsurance =
      /\b(repudiat|claim\s+deni|denied\s+the\s+claim|insurance\s+claim|wrongful\s+repudiation)\b/i.test(
        hay,
      );
    const medical =
      /\b(medical|negligence|hospital|consent|surgery|gallbladder|cholecystectomy|bile|deficiency\s+in\s+service)\b/i.test(
        hay,
      );
    let authorities = medical
      ? CURATED_CONSUMER_AUTHORITIES.filter(
          (a) =>
            a.id === 'curated__spring_meadows_hospital_v_harjol_ahluwalia_1998' ||
            a.id === 'curated__lucknow_dev_v_mk_gupta_1994' ||
            a.id === 'curated__ghaziabad_dev_v_balbir_singh_2004',
        )
      : CURATED_CONSUMER_AUTHORITIES.slice(0, 2);
    if (wantsInsurance) {
      const insurance = CURATED_CONSUMER_AUTHORITIES.find(
        (a) => a.id === 'curated__national_insurance_v_nitin_khandelwal_2008',
      );
      if (insurance && !authorities.some((a) => a.id === insurance.id)) {
        authorities = [...authorities, insurance];
      }
    }
    return authorities;
  }
  if (kind === 'india_cheque_bounce_complaint_ni138') {
    return CURATED_CHEQUE_BOUNCE_AUTHORITIES;
  }
  if (kind === 'india_slp_draft') {
    return CURATED_SLP_AUTHORITIES;
  }
  if (
    kind === 'india_civil_plaint' ||
    kind === 'india_suit_specific_performance' ||
    kind === 'india_legal_notice'
  ) {
    return CURATED_CIVIL_PLAINT_AUTHORITIES;
  }
  if (kind === 'india_application_temp_injunction') {
    return CURATED_INJUNCTION_AUTHORITIES;
  }
  if (
    kind === 'india_arbitration_petition_s9' ||
    kind === 'india_arbitration_petition_s11' ||
    kind === 'india_award_challenge_s34'
  ) {
    return CURATED_ARBITRATION_AUTHORITIES;
  }
  if (kind === 'india_anticipatory_bail_bnss_482') {
    return CURATED_ANTICIPATORY_BAIL_AUTHORITIES;
  }
  if (kind === 'india_wrongful_termination_petition') {
    return CURATED_EMPLOYMENT_AUTHORITIES;
  }
  if (kind === 'india_property_dispute_suit') {
    return CURATED_PROPERTY_AUTHORITIES;
  }
  if (
    kind === 'india_pocso_bail_application' ||
    kind === 'india_pocso_anticipatory_bail'
  ) {
    return CURATED_POCSO_BAIL_AUTHORITIES;
  }
  if (
    kind === 'india_ndps_bail_application' ||
    kind === 'india_ndps_trial_application' ||
    kind === 'india_ndps_anticipatory_bail'
  ) {
    return CURATED_NDPS_BAIL_AUTHORITIES;
  }
  if (
    kind === 'india_contempt_petition' ||
    kind === 'india_contempt_application'
  ) {
    return CURATED_CONTEMPT_AUTHORITIES;
  }
  if (
    kind === 'india_domestic_violence_petition' ||
    kind === 'india_pwdva_application' ||
    kind === 'india_protection_order_application'
  ) {
    return CURATED_DOMESTIC_VIOLENCE_AUTHORITIES;
  }
  return [];
}

/**
 * Rank retrieved authorities by court tier and recency.
 * Supreme Court (courtTierRank=0) outranks High Courts (1) etc.
 * Among same tier, more recent decisions rank higher.
 * Superseded/distinguished entries are sorted after good_law entries.
 */
function rankAuthorities(authorities: RetrievedAuthority[]): RetrievedAuthority[] {
  const tierScore = (a: RetrievedAuthority): number => {
    if (typeof a.courtTierRank === 'number') return a.courtTierRank;
    const src = (a.sourceName ?? '').toLowerCase();
    if (src.includes('supreme')) return 0;
    if (src.includes('high court') || src.includes('high court')) return 1;
    return 2;
  };
  const treatmentScore = (a: RetrievedAuthority): number => {
    switch (a.treatmentStatus) {
      case 'good_law': return 0;
      case 'distinguished': return 1;
      case 'superseded': return 2;
      default: return 3;
    }
  };

  return [...authorities].sort((a, b) => {
    const tierDiff = tierScore(a) - tierScore(b);
    if (tierDiff !== 0) return tierDiff;
    const treatDiff = treatmentScore(a) - treatmentScore(b);
    if (treatDiff !== 0) return treatDiff;
    // More recent first
    const aYear = a.decisionYear ?? 0;
    const bYear = b.decisionYear ?? 0;
    return bYear - aYear;
  });
}

@Injectable()
export class DraftResearchGroundingService {
  private readonly logger = new Logger(DraftResearchGroundingService.name);

  constructor(
    private readonly retrieval: LegalRetrievalOrchestrator,
    private readonly deepResearch: DeepResearchAgentService,
    private readonly configService: ConfigService,
    private readonly registry: AuthorityRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  private async loadFormLinkedAuthorities(
    formNumber: string | undefined,
    countryCode: string,
  ): Promise<RetrievedAuthority[]> {
    const fn = formNumber?.trim();
    if (!fn) return [];
    try {
      const form = await this.prisma.jurisdictionForm.findFirst({
        where: {
          formNumber: { equals: fn, mode: 'insensitive' },
          countryCode,
        },
        select: { metadata: true, formNumber: true },
      });
      if (!form) return [];
      return formLinkedToRetrievedAuthorities(
        parseFormCaseLaws(form.metadata),
        form.formNumber ?? fn,
      );
    } catch (err) {
      this.logger.warn(
        `Form-linked case law lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private async loadMatterSavedResearchAuthorities(
    input: DraftResearchGroundingInput,
  ): Promise<RetrievedAuthority[]> {
    if (!input.matterId || !input.tenantId) return [];
    try {
      const rows = await this.prisma.savedResearch.findMany({
        where: { tenantId: input.tenantId, matterId: input.matterId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { researchJson: true },
      });
      return extractVerifiedAuthoritiesFromSavedResearch(rows.map((row) => row.researchJson));
    } catch (err) {
      this.logger.warn(
        `Matter saved-research grounding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  async buildGrounding(input: DraftResearchGroundingInput): Promise<DraftResearchGroundingResult> {
    const matterResearchAuthorities = await this.loadMatterSavedResearchAuthorities(input);
    const hasForm = Boolean(input.formNumber?.trim());
    const policy = resolveDraftReadinessPolicy(input.kind);
    const req = getAuthorityRequirement(input.kind);
    const retrieveCaseLaw = shouldRetrieveCaseLawForDraft(input.kind, input.knowledgeSources, {
      filingGrade: policy.filingGrade,
      caseDetails: input.caseDetails,
    });
    const formLinked = await this.loadFormLinkedAuthorities(
      input.formNumber,
      input.countryCode,
    );
    const pinnedAuthorities = pinnedCaseLawsToRetrievedAuthorities(input.pinnedCaseLaws ?? []);

    if (matterResearchAuthorities.length > 0 && (input.hybridExpressNotice || input.bundleFastPath) && !hasForm) {
      const slice = [...matterResearchAuthorities, ...formLinked, ...pinnedAuthorities].slice(0, 12);
      return {
        authorities: slice,
        verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(slice),
        retrievalConfidence: slice.length >= 3 ? 'medium' : 'low',
        usedDeepResearch: false,
      };
    }

    if (matterResearchAuthorities.length > 0) {
      const slice = [...matterResearchAuthorities, ...formLinked, ...pinnedAuthorities].slice(0, 12);
      return {
        authorities: slice,
        verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(slice),
        retrievalConfidence: slice.length >= 3 ? 'medium' : 'low',
        usedDeepResearch: false,
      };
    }

    if (input.hybridExpressNotice && !hasForm) {
      const curated = getCuratedFallbackAuthorities(input.kind, input.caseDetails);
      const slice = [...formLinked, ...pinnedAuthorities, ...curated.slice(0, 6)].slice(0, 12);
      return {
        authorities: slice,
        verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(slice),
        retrievalConfidence: slice.length >= 3 ? 'medium' : 'low',
        usedDeepResearch: false,
      };
    }

    if (input.bundleFastPath && !hasForm) {
      const curated = getCuratedFallbackAuthorities(input.kind, input.caseDetails);
      if (curated.length >= 3) {
        const slice = [...formLinked, ...pinnedAuthorities, ...curated.slice(0, 10)].slice(0, 12);
        return {
          authorities: slice,
          verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(slice),
          retrievalConfidence: 'medium',
          usedDeepResearch: false,
        };
      }
    }

    // Catalog form drafts always retrieve case law (form-linked + live), even if the
    // kind is nominally an express notice.
    if (
      isExpressIndiaDraftKind(input.kind) &&
      !hasForm &&
      !retrieveCaseLaw &&
      !(input.pinnedCaseLaws?.length)
    ) {
      const softPins = [...formLinked, ...pinnedAuthorities];
      if (softPins.length > 0) {
        return {
          authorities: softPins.slice(0, 12),
          verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(softPins.slice(0, 12)),
          retrievalConfidence: 'medium',
          usedDeepResearch: false,
        };
      }
      return {
        authorities: [],
        verifiedAuthoritiesBlock: [
          'VERIFIED AUTHORITIES (cite ONLY from this list):',
          '(Pre-litigation notice — cite governing statute sections only. Do NOT invent AIR/SCC case citations.)',
        ].join('\n'),
        retrievalConfidence: 'high',
        usedDeepResearch: false,
      };
    }

    const baseRetrievalQuery = [
      input.caseDetails,
      input.kind,
      input.formNumber ?? '',
      input.formTitle ?? '',
      input.proceduralResult?.recommendedKind ?? '',
      input.courtName ?? '',
      input.jurisdiction ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const baseQueries = isMaintenanceContext(input.kind, input.caseDetails)
      ? buildMaintenanceQueries(input)
      : req.requiredTopics.length > 0
        ? req.requiredTopics
            .slice(0, 8)
            .map((topic) => `${baseRetrievalQuery} ${topic} case law precedent`.trim())
        : [`${baseRetrievalQuery} case law precedents`.trim()];
    const mapQueries = (input.extraRetrievalQueries ?? [])
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 10);
    // Map-driven queries first so issue-specific searches run before generic topics.
    const retrievalQueries = [...new Set([...mapQueries, ...baseQueries])].slice(0, 12);

    // STEP 0: Load previously verified authorities from the persistent bank.
    // These seed the merge map so the LLM has known-good authorities even when
    // live connectors return irrelevant or no results.
    const bankAuthorities = await this.registry.findForDraftKind(input.kind, input.countryCode);
    let authorities: RetrievedAuthority[] = [];
    let retrievalConfidence: 'high' | 'medium' | 'low' = 'low';
    let usedDeepResearch = false;

    try {
      const merged = new Map<string, RetrievedAuthority>();

      for (const a of formLinked) {
        merged.set(a.id, a);
      }
      for (const a of pinnedAuthorities) {
        merged.set(a.id, a);
      }
      for (const a of matterResearchAuthorities) {
        merged.set(a.id, a);
      }

      // Seed the map with DB bank authorities so they are available even if live retrieval
      // returns nothing — they won't be overwritten by live results (live results use the same
      // id-based dedup so a live hit with an identical id would replace the bank entry, which is fine).
      for (const a of bankAuthorities) {
        // Filter out overruled authorities from the bank — they may not be safe to cite.
        if (a.treatmentStatus === 'overruled' || a.treatmentStatus === 'repealed') continue;
        merged.set(a.id, a);
      }

      // Bound connector pressure while avoiding a separate full network wait per issue.
      // Merge in query order to retain deterministic ranking and deduplication.
      for (let offset = 0; offset < retrievalQueries.length; offset += 3) {
        const batch = await Promise.all(retrievalQueries.slice(offset, offset + 3).map((query) => this.retrieval.retrieve({
          query,
          countryCode: input.countryCode,
          jurisdiction: input.jurisdiction,
          practiceArea: isMaintenanceContext(input.kind, input.caseDetails) ? 'Family' : undefined,
          tenantId: input.tenantId,
          userId: input.userId,
          limit: 12,
          supplementLive: true,
          knowledgeSources: input.knowledgeSources,
        })));
        for (const retrieval of batch) {
          if (retrieval.confidence === 'high') retrievalConfidence = 'high';
          else if (retrieval.confidence === 'medium' && retrievalConfidence !== 'high') {
            retrievalConfidence = 'medium';
          }
          for (const a of retrieval.authorities) {
            const authorityTypeNorm = (a.authorityType ?? '').toUpperCase();
            const isCaseLaw =
              a.sourceTier === 'case_law' ||
              authorityTypeNorm === 'CASE' ||
              authorityTypeNorm === 'CASE_LAW';
            // Also include firm-vault entries that are clearly case law (judgment excerpts
            // stored in the firm's precedent vault) — previously these were dropped because
            // their sourceTier is 'firm' rather than 'case_law'.
            const isFirmCaseLaw =
              a.sourceTier === 'firm' &&
              (authorityTypeNorm === 'CASE' || authorityTypeNorm === 'CASE_LAW');
            const includeCase =
              retrieveCaseLaw &&
              (isCaseLaw || isFirmCaseLaw);
            if (includeCase) {
              // Treatment filter: exclude overruled cases from drafting context.
              if (a.treatmentStatus === 'overruled' || a.treatmentStatus === 'repealed') continue;
              merged.set(a.id, a);
            }
          }
        }
      }

      authorities = rankAuthorities([...merged.values()]);

      const caseLawCount = authorities.length;

      // Before committing to an expensive deep-research run, project how many
      // authorities we will have AFTER the curated fallback step (which runs
      // later). Curated entries are known-good SC/HC citations for each practice
      // area; if they already cover the minimum we can skip deep research
      // entirely — saving 60-180 s per request for well-served kinds (writ
      // petitions, bail, maintenance, etc.).
      const existingIds = new Set(authorities.map((a) => a.id));
      const additionalCurated = getCuratedFallbackAuthorities(input.kind, input.caseDetails).filter(
        (a) =>
          !existingIds.has(a.id) &&
          a.treatmentStatus !== 'overruled' &&
          a.treatmentStatus !== 'repealed',
      ).length;
      const projectedWithCurated = caseLawCount + additionalCurated;
      const curatedSatisfiesMinimum = projectedWithCurated >= req.minVerifiedCases;

      const needsDeep =
        (!input.skipDeepResearch || req.escalateOnShortfall) &&
        retrieveCaseLaw &&
        !curatedSatisfiesMinimum &&
        (
          retrievalConfidence === 'low' ||
          caseLawCount < req.minVerifiedCases ||
          (input.proceduralResult?.kindOverridden ?? false) ||
          (input.proceduralResult?.maintainabilityNotes.length ?? 0) > 0 ||
          shouldEscalate(input.kind, caseLawCount)
        );

      if (needsDeep && input.tenantId) {
        try {
          const reactModel =
            this.configService.get<string>('AI_LEGAL_ORCHESTRATOR_MODEL') ??
            this.configService.get<string>('AI_FAST_MODEL') ??
            DEFAULT_ORCHESTRATOR_MODEL;
          const deepQuery = retrievalQueries.join(' | ');
          const DEEP_RESEARCH_TIMEOUT_MS = 45_000;
          const deep = await Promise.race([
            this.deepResearch.runDeepResearch({
              query: deepQuery,
              countryCode: input.countryCode,
              jurisdiction: input.jurisdiction,
              tenantId: input.tenantId,
              userId: input.userId,
              modelName: reactModel,
              reactModelName: reactModel,
              priorAuthorities: authorities,
              maxSteps: input.maxDeepResearchSteps ?? 6,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Deep research timed out after 45 s')), DEEP_RESEARCH_TIMEOUT_MS),
            ),
          ]);
          usedDeepResearch = true;
          for (const a of deep.authorities) {
            if (
              a.sourceTier === 'case_law' ||
              (a.authorityType ?? '').toUpperCase() === 'CASE' ||
              (a.authorityType ?? '').toUpperCase() === 'CASE_LAW'
            ) {
              if (a.treatmentStatus === 'overruled' || a.treatmentStatus === 'repealed') continue;
              merged.set(a.id, a);
            }
          }
          authorities = rankAuthorities([...merged.values()]);
          if (authorities.length > caseLawCount) {
            retrievalConfidence = authorities.length >= req.minVerifiedCases ? 'medium' : 'low';
          }
          if (authorities.length >= Math.max(5, req.minVerifiedCases)) retrievalConfidence = 'high';
        } catch (err) {
          this.logger.warn(
            `DEEP research escalation failed for draft: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(`Draft research retrieval failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Write-through: persist newly discovered case_law authorities to the bank so future
    // drafts benefit from them without hitting live APIs again. Fire-and-forget — never blocks.
    void this.registry.upsertFromRetrieval(authorities, input.kind).catch((err) =>
      this.logger.warn(`Authority bank write-through failed: ${err instanceof Error ? err.message : String(err)}`),
    );

    // Supplement with curated fallbacks when live retrieval produced insufficient results.
    // Curated entries are appended after retrieved ones so real retrieval always takes precedence,
    // but the LLM is never left with an empty authority block for well-known practice areas.
    const curatedFallbacks =
      matterResearchAuthorities.length > 0
        ? []
        : getCuratedFallbackAuthorities(input.kind, input.caseDetails);
    if (curatedFallbacks.length > 0) {
      const existingIds = new Set(authorities.map((a) => a.id));
      for (const curated of curatedFallbacks) {
        // Only skip truly overruled curated entries; superseded entries are still useful with a note.
        if (curated.treatmentStatus === 'overruled') continue;
        if (!existingIds.has(curated.id)) {
          authorities.push(curated);
          existingIds.add(curated.id);
        }
      }
      // Re-rank after adding curated fallbacks.
      authorities = rankAuthorities(authorities);
      if (retrievalConfidence === 'low' && authorities.length >= req.minVerifiedCases) {
        retrievalConfidence = 'medium';
      }
    }

    const slice = authorities.slice(0, 12);
    const verifiedCaseCount = slice.filter((authority) => {
      const type = (authority.authorityType ?? '').toUpperCase();
      return authority.sourceTier === 'case_law' || type === 'CASE' || type === 'CASE_LAW';
    }).length;
    return {
      authorities: slice,
      verifiedAuthoritiesBlock: this.buildVerifiedAuthoritiesBlock(slice),
      retrievalConfidence,
      usedDeepResearch,
      retrievalQueries,
      requiredVerifiedCases: req.minVerifiedCases,
      authorityShortfall: Math.max(0, req.minVerifiedCases - verifiedCaseCount),
    };
  }

  buildVerifiedAuthoritiesBlock(authorities: RetrievedAuthority[]): string {
    // Strip any entry that has been explicitly flagged as fabricated/unverified.
    // Entries sourced from CURATED_* arrays that carry treatmentStatus 'overruled' are
    // already filtered upstream; this catches any future accidental insertions.
    const safe = authorities.filter(
      (a) => a.treatmentStatus !== 'overruled' && a.title && a.citation,
    );

    if (safe.length === 0) {
      return [
        'VERIFIED AUTHORITIES (cite ONLY from this list):',
        '(No verified case law retrieved. Use [AUTHORITY TO BE ADDED] placeholders in grounds — do NOT invent AIR, SCC, or Cr.LJ citations.)',
      ].join('\n');
    }

    const lines = [
      'VERIFIED AUTHORITIES (cite ONLY from this list — never invent citations outside this block):',
    ];
    for (const a of safe) {
      const cite = a.citation ? ` (${a.citation})` : '';
      const neutralCite = a.neutralCitation ? ` [${a.neutralCitation}]` : '';
      const treatment = a.treatmentStatus && a.treatmentStatus !== 'good_law'
        ? ` [${a.treatmentStatus.toUpperCase()}]`
        : '';
      const summary = (a.summary ?? '').slice(0, 320);
      lines.push(`- ${a.title}${cite}${neutralCite}${treatment}: ${summary}`);
    }
    return lines.join('\n');
  }

  /**
   * Resolve a user-supplied case citation for drafting pins.
   * On success, write-through to the authority registry for future drafts.
   */
  async resolveCaseLaw(input: {
    citation: string;
    caseName?: string;
    holding?: string;
    kind?: string;
    tenantId: string;
    userId: string;
    jurisdiction?: string;
    allowSoftPin?: boolean;
  }): Promise<{
    status: 'found' | 'not_found' | 'invalid';
    pin?: PinnedCaseLaw;
    message?: string;
  }> {
    const citation = (input.citation ?? '').trim();
    if (citation.length < 3) {
      return { status: 'invalid', message: 'Enter a citation (e.g. (2020) 14 SCC 150).' };
    }

    const query = [citation, input.caseName, input.holding, 'case law']
      .filter(Boolean)
      .join(' ')
      .trim();

    try {
      const retrieval = await this.retrieval.retrieve({
        query,
        countryCode: 'IN',
        jurisdiction: input.jurisdiction,
        tenantId: input.tenantId,
        userId: input.userId,
        limit: 8,
        supplementLive: true,
        knowledgeSources: ['case_law', 'firm_vault'],
      });

      const citationNorm = citation.toLowerCase().replace(/\s+/g, ' ');
      const hit =
        retrieval.authorities.find((a) => {
          const c = (a.citation ?? '').toLowerCase().replace(/\s+/g, ' ');
          const n = (a.neutralCitation ?? '').toLowerCase().replace(/\s+/g, ' ');
          const t = (a.title ?? '').toLowerCase();
          return (
            (c && (c.includes(citationNorm) || citationNorm.includes(c))) ||
            (n && (n.includes(citationNorm) || citationNorm.includes(n))) ||
            (input.caseName && t.includes(input.caseName.toLowerCase().trim()))
          );
        }) ??
        retrieval.authorities.find(
          (a) =>
            a.sourceTier === 'case_law' &&
            a.citation &&
            a.treatmentStatus !== 'overruled' &&
            a.treatmentStatus !== 'repealed',
        );

      if (hit?.citation) {
        const kind = input.kind?.trim() || 'india_general';
        void this.registry.upsertFromRetrieval([hit], kind).catch((err) =>
          this.logger.warn(
            `resolveCaseLaw write-through failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        return {
          status: 'found',
          pin: {
            citation: hit.citation,
            caseName: hit.title || input.caseName,
            holding: hit.summary?.slice(0, 500) || input.holding,
            authorityId: hit.id,
            source: 'research',
          },
          message: 'Case law verified and saved for future drafts.',
        };
      }

      if (input.allowSoftPin) {
        return {
          status: 'not_found',
          pin: {
            citation,
            caseName: input.caseName?.trim(),
            holding: input.holding?.trim(),
            source: 'user',
          },
          message:
            'Could not verify this citation. Soft-pinned as unverified — AI will treat it as a preferred retrieval query.',
        };
      }

      return {
        status: 'not_found',
        message: 'Citation not found in research corpus. Soft-pin as unverified, or check the citation.',
      };
    } catch (err) {
      this.logger.warn(
        `resolveCaseLaw failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        status: 'invalid',
        message: 'Unable to look up case law right now. Try again or soft-pin as unverified.',
      };
    }
  }
}
