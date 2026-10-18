import { Injectable } from '@nestjs/common';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';
import { CitationFirstLookupService } from '@/legal-search/citation-first-lookup.service';
import { HybridSearchService } from '@/legal-sources/search/hybrid-search.service';
import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import { normalizeIndiaDraftStatutes } from '@/ai/india-draft/india-draft-statute-normalizer';
import type { EvalBenchmarkResult } from '@/eval/eval-suite.runner';
import { ClaimLevelVerificationService } from '@/ai/legal-research/claim-level-verification.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { DraftArchetypeRouterService } from '@/ai/drafting/archetypes/draft-archetype-router.service';
import { DraftLegalRegisterService } from '@/ai/drafting/draft-legal-register.service';
import { DraftFactFidelityService } from '@/ai/drafting/draft-fact-fidelity.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftProceduralTimelineValidator } from '@/ai/drafting/draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from '@/ai/drafting/draft-case-fact-coverage.service';
import { documentKindToDraftKind } from '@/ai/draft-intent/draft-intent.helpers';
import { checkDomainCompleteness } from '@/ai/legal-research/domain-completeness-checker';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';
import { computeCitationEvalMetrics } from './citation-eval-metrics';
import {
  UPI_CITATION_EVAL_OUTPUT,
  UPI_GOLDEN_RESEARCH_OUTPUT,
  UPI_OFF_POINT_AUTHORITIES,
  UPI_REGRESSION_QUERY,
} from './upi-legal-research-golden.fixture';
import {
  evaluateMatrimonialGoldenCase,
  MATRIMONIAL_RESEARCH_GOLDEN_CASES,
} from './matrimonial-research-golden.fixture';

export type GoldenEvalCase = {
  id: string;
  category: string;
  query: string;
  countryCode: string;
  expectInOutput?: RegExp[];
  forbidInOutput?: RegExp[];
  expectAuthorityPattern?: RegExp;
  isBareActQuery?: boolean;
};

/** Deterministic draft archetype golden cases (no LLM). */
export type DraftArchetypeGoldenCase = {
  id: string;
  jurisdiction: 'IN' | 'US';
  caseDetails: string;
  documentKind?: string;
  offenceDate?: string;
  expectKind?: RegExp;
  expectSections?: Array<{ actId: string; section: string }>;
  expectRegister?: string;
  forbidDraftPatterns?: RegExp[];
  sampleDraft?: string;
};

export const UMBRELLA_LEGAL_EVAL_V1: GoldenEvalCase[] = [
  { id: 'bare-101-bnss', category: 'single_source_bare_act', query: '101 bnss', countryCode: 'IN', expectInOutput: [/district magistrate|complaint on oath/i], forbidInOutput: [/does not exist|section 436|s\.436/i, /high court writ/i], expectAuthorityPattern: /bnss|101/i, isBareActQuery: true },
  { id: 'bare-art-21', category: 'single_source_bare_act', query: 'article 21 constitution', countryCode: 'IN', expectInOutput: [/life|personal liberty/i], forbidInOutput: [/131st.*amendment bill/i], isBareActQuery: true },
  { id: 'remap-crpc-98', category: 'remap_queries', query: 'crpc section 98', countryCode: 'IN', expectAuthorityPattern: /bnss|101/i, isBareActQuery: true },
  { id: 'remap-crpc-125', category: 'remap_queries', query: 'maintenance under crpc 125', countryCode: 'IN', expectInOutput: [/maintenance/i], isBareActQuery: true },
  { id: 'multi-bail', category: 'multi_source', query: 'anticipatory bail BNSS landmark SC case', countryCode: 'IN', expectInOutput: [/bail/i] },
  { id: 'intake-maintenance', category: 'intake_advisory', query: 'wife maintenance crpc 125 husband employed', countryCode: 'IN', expectInOutput: [/maintenance/i] },
  { id: 'jk-overlay', category: 'jurisdiction_overlay', query: 'article 21 Jammu Kashmir applicability', countryCode: 'IN', expectInOutput: [/jammu|kashmir|appendix|central act/i] },
  { id: 'negative-131st', category: 'negative', query: 'current law 131st constitutional amendment bill', countryCode: 'IN', forbidInOutput: [/is current law|has been enacted/i] },
  { id: 'bare-bns-103', category: 'single_source_bare_act', query: 'bns section 103 murder', countryCode: 'IN', expectInOutput: [/punishment|murder/i], isBareActQuery: true },
  { id: 'art-330a', category: 'single_source_bare_act', query: 'article 330A reservation', countryCode: 'IN', expectInOutput: [/reservation|scheduled/i], forbidInOutput: [/131st/i], isBareActQuery: true },
  {
    id: 'draft-maintenance-crpc125',
    category: 'india_draft_normalizer',
    query: 'maintenance appeal crpc 125 wrong bns successor',
    countryCode: 'IN',
    expectInOutput: [/Section 144 of the Bharatiya Nagarik Suraksha Sanhita/i],
    forbidInOutput: [/Bharatiya Nyaya Sanhita.*125/i],
  },
  {
    id: 'ram-ria-maintenance-revision',
    category: 'india_draft_intent',
    query: 'Draft an appeal interim order 125 crpc maintenance Ram vs Ria Gujarat HC',
    countryCode: 'IN',
    expectInOutput: [/CRIMINAL REVISION PETITION|india_maintenance_order_revision/i, /BNSS.*438|438.*BNSS/i, /BNSS.*144|144.*BNSS/i],
    forbidInOutput: [/service_agreement/i, /Article\s+133/i, /CIVIL APPEAL/i, /balance of convenience/i, /Counsel.*Certif/i],
  },
  {
    id: 'bnss-acronym-trap',
    category: 'india_draft_sanitizer',
    query: 'BNSS means Nyaya Sanhita',
    countryCode: 'IN',
    expectInOutput: [/Bharatiya Nagarik Suraksha Sanhita/i],
    forbidInOutput: [/BNSS.*Nyaya Sanhita/i],
  },
];

/** Case-law retrieval and citation golden set (Phase 3D). */
export const CASE_LAW_GOLDEN_EVAL: GoldenEvalCase[] = [
  { id: 'cite-insc-2026-ai-citations', category: 'case_law_neutral_cite', query: '2026 INSC 668', countryCode: 'IN', expectAuthorityPattern: /Pooja Ramesh Singh|Jammu and Kashmir Bank/i },
  { id: 'title-2026-ai-citations', category: 'case_law_citation', query: 'Pooja Ramesh Singh AI generated citations NCLT', countryCode: 'IN', expectAuthorityPattern: /Pooja Ramesh Singh|hallucinated citations/i },
  { id: 'cite-insc-2026-land-acquisition', category: 'case_law_neutral_cite', query: '2026 INSC 138', countryCode: 'IN', expectAuthorityPattern: /S\.V\. Global Mill|Land Acquisition/i },
  { id: 'cite-insc-2026-end-of-life', category: 'case_law_neutral_cite', query: '2026 INSC 222', countryCode: 'IN', expectAuthorityPattern: /Harish Rana|withdrawal/i },
  { id: 'cite-scc-1980-bail', category: 'case_law_citation', query: '(1980) 2 SCC 565 anticipatory bail', countryCode: 'IN', expectAuthorityPattern: /SCC|565|Sibbia/i },
  { id: 'cite-air-1973-kesavananda', category: 'case_law_citation', query: 'AIR 1973 SC 1461 basic structure', countryCode: 'IN', expectAuthorityPattern: /Kesavananda|1461/i },
  { id: 'cite-scc-2014-arnesh', category: 'case_law_citation', query: '(2014) 8 SCC 273 arrest dowry', countryCode: 'IN', expectAuthorityPattern: /Arnesh|SCC.*273/i },
  { id: 'cite-scc-2010-ni138', category: 'case_law_citation', query: '(2010) 11 SCC 441 section 138 NI Act', countryCode: 'IN', expectAuthorityPattern: /Rangappa|SCC.*441/i },
  { id: 'cite-scc-2020-maintenance', category: 'case_law_citation', query: '(2020) 14 SCC 150 maintenance guidelines', countryCode: 'IN', expectAuthorityPattern: /Rajnesh|SCC.*150/i },
  { id: 'cite-scc-2019-ibc', category: 'case_law_citation', query: '(2019) 4 SCC 17 IBC constitutional validity', countryCode: 'IN', expectAuthorityPattern: /Swiss Ribbons|SCC/i },
  { id: 'cite-scc-2017-privacy', category: 'case_law_citation', query: '(2017) 10 SCC 1 privacy Puttaswamy', countryCode: 'IN', expectAuthorityPattern: /Puttaswamy|privacy/i },
  { id: 'cite-scc-2015-shreya', category: 'case_law_citation', query: '(2015) 5 SCC 1 section 66A struck down', countryCode: 'IN', expectAuthorityPattern: /Shreya|SCC/i },
  { id: 'cite-scc-1994-bommai', category: 'case_law_citation', query: '(1994) 3 SCC 1 President Rule judicial review', countryCode: 'IN', expectAuthorityPattern: /Bommai|SCC/i },
  { id: 'cite-scc-2006-umadevi', category: 'case_law_citation', query: '(2006) 4 SCC 1 regularisation daily wage', countryCode: 'IN', expectAuthorityPattern: /Umadevi|SCC/i },
  { id: 'pa-criminal-bail', category: 'case_law_practice_area', query: 'landmark Supreme Court anticipatory bail principles India', countryCode: 'IN', expectInOutput: [/bail/i], expectAuthorityPattern: /SCC|bail/i },
  { id: 'pa-ni-act', category: 'case_law_practice_area', query: 'NI Act section 138 presumption dishonour cheque Supreme Court', countryCode: 'IN', expectInOutput: [/138|cheque|presumption/i] },
  { id: 'pa-consumer', category: 'case_law_practice_area', query: 'consumer deficiency medical negligence Supreme Court', countryCode: 'IN', expectInOutput: [/deficien|consumer|medical/i] },
  { id: 'pa-ibc', category: 'case_law_practice_area', query: 'IBC moratorium Committee of Creditors Supreme Court', countryCode: 'IN', expectInOutput: [/moratorium|creditor|IBC/i] },
  { id: 'pa-maintenance', category: 'case_law_practice_area', query: 'maintenance under BNSS 144 Supreme Court quantum', countryCode: 'IN', expectInOutput: [/maintenance/i] },
  { id: 'pa-constitutional-privacy', category: 'case_law_practice_area', query: 'right to privacy Article 21 Supreme Court judgment', countryCode: 'IN', expectInOutput: [/privacy|Article 21/i] },
  { id: 'pa-labour', category: 'case_law_practice_area', query: 'contract labour absorption Supreme Court principles', countryCode: 'IN', expectInOutput: [/contract labour|absorption/i] },
  { id: 'pa-tax-vodafone', category: 'case_law_practice_area', query: 'Vodafone indirect transfer tax Supreme Court', countryCode: 'IN', expectInOutput: [/Vodafone|transfer/i] },
  { id: 'pa-property-specific', category: 'case_law_practice_area', query: 'specific performance agreement to sell Supreme Court readiness', countryCode: 'IN', expectInOutput: [/specific performance|readiness/i] },
  { id: 'pa-family-cruelty', category: 'case_law_practice_area', query: 'mental cruelty divorce Supreme Court Samar Ghosh', countryCode: 'IN', expectInOutput: [/cruelty|divorce/i] },
  { id: 'overruled-adm-jabalpur', category: 'case_law_treatment', query: 'ADM Jabalpur habeas corpus emergency overruled', countryCode: 'IN', expectInOutput: [/overruled|habeas|emergency/i] },
  { id: 'neutral-2017-insc', category: 'case_law_neutral_cite', query: '2017 INSC privacy judgment', countryCode: 'IN', expectAuthorityPattern: /Puttaswamy|INSC|2017/i },
  { id: 'scr-reporter', category: 'case_law_reporter', query: '[2024] 3 SCR 627 industrial dispute settlement', countryCode: 'IN', expectInOutput: [/settlement|industrial|dispute/i] },
  { id: 'quash-bhajan-lal', category: 'case_law_quash', query: 'Bhajan Lal categories FIR quash', countryCode: 'IN', expectAuthorityPattern: /Bhajan|SCC.*335/i },
  { id: 'quash-muniswamy', category: 'case_law_quash', query: 'Muniswamy quash FIR no cognizable offence', countryCode: 'IN', expectAuthorityPattern: /Muniswamy|SCC/i },
  { id: 'cite-scc-2018-377', category: 'case_law_citation', query: '(2018) 10 SCC 1 section 377 unconstitutional', countryCode: 'IN', expectAuthorityPattern: /Navtej|377/i },
  { id: 'cite-scc-2019-adultery', category: 'case_law_citation', query: '(2019) 3 SCC 39 adultery struck down', countryCode: 'IN', expectAuthorityPattern: /Joseph Shine|497/i },
  { id: 'cite-scc-2014-transgender', category: 'case_law_citation', query: '(2014) 5 SCC 438 transgender NALSA', countryCode: 'IN', expectAuthorityPattern: /NALSA|transgender/i },
  { id: 'cite-scc-2017-triple-talaq', category: 'case_law_citation', query: '(2017) 9 SCC 1 triple talaq', countryCode: 'IN', expectAuthorityPattern: /Shayara|talaq/i },
  { id: 'cite-scc-2020-ayodhya', category: 'case_law_citation', query: '(2020) 1 SCC 1 Ayodhya title', countryCode: 'IN', expectAuthorityPattern: /Siddiq|Ayodhya/i },
  { id: 'cite-scc-2012-suraj-lamp', category: 'case_law_citation', query: '(2012) 1 SCC 656 GPA sale registration', countryCode: 'IN', expectAuthorityPattern: /Suraj Lamp|registration/i },
  { id: 'cite-scc-2021-vidya-drolia', category: 'case_law_citation', query: '(2021) 2 SCC 1 arbitrability landlord tenant', countryCode: 'IN', expectAuthorityPattern: /Vidya Drolia|arbitr/i },
  { id: 'cite-scc-2018-compound-ni', category: 'case_law_citation', query: '(2018) 1 SCC 560 NI Act compounding mediation', countryCode: 'IN', expectAuthorityPattern: /Meters|compound/i },
  { id: 'cite-scc-2014-jurisdiction-ni', category: 'case_law_citation', query: '(2014) 9 SCC 129 NI Act jurisdiction drawee bank', countryCode: 'IN', expectAuthorityPattern: /Dashrath|jurisdiction/i },
  { id: 'cite-scc-2020-essar', category: 'case_law_citation', query: '(2020) 8 SCC 531 Essar Steel CoC', countryCode: 'IN', expectAuthorityPattern: /Essar|creditor/i },
  { id: 'cite-scc-2019-pioneer-rera', category: 'case_law_citation', query: '(2019) 8 SCC 416 RERA IBC home buyers', countryCode: 'IN', expectAuthorityPattern: /Pioneer|RERA/i },
  { id: 'cite-scc-1995-medical-cpa', category: 'case_law_citation', query: '(1995) 6 SCC 651 medical negligence consumer', countryCode: 'IN', expectAuthorityPattern: /IMA|medical|consumer/i },
  { id: 'cite-scc-1994-lda-consumer', category: 'case_law_citation', query: '(1994) 1 SCC 243 LDA consumer service', countryCode: 'IN', expectAuthorityPattern: /Lucknow|consumer/i },
  { id: 'cite-scc-2001-nilajkar', category: 'case_law_citation', query: '(2003) 4 SCC 27 regularisation daily wage', countryCode: 'IN', expectAuthorityPattern: /Nilajkar|regular/i },
  { id: 'cite-scc-2014-equal-pay', category: 'case_law_citation', query: '(2014) 6 SCC 792 equal pay daily wager Punjab', countryCode: 'IN', expectAuthorityPattern: /Rafiq|equal pay/i },
  { id: 'cite-scc-1981-minerva', category: 'case_law_citation', query: 'AIR 1980 SC 1789 Minerva Mills basic structure', countryCode: 'IN', expectAuthorityPattern: /Minerva|basic structure/i },
  { id: 'cite-scc-1993-mandal', category: 'case_law_citation', query: 'AIR 1993 SC 477 Mandal reservation cap', countryCode: 'IN', expectAuthorityPattern: /Indira Sawhney|Mandal|50/i },
  { id: 'cite-scc-2007-coelho', category: 'case_law_citation', query: '(2007) 2 SCC 1 Ninth Schedule basic structure', countryCode: 'IN', expectAuthorityPattern: /Coelho|Ninth Schedule/i },
  { id: 'cite-scc-2012-vodafone', category: 'case_law_citation', query: '(2012) 6 SCC 613 Vodafone tax', countryCode: 'IN', expectAuthorityPattern: /Vodafone|tax/i },
  { id: 'cite-scc-2004-dtaa', category: 'case_law_citation', query: '(2004) 10 SCC 1 Azadi Bachao DTAA', countryCode: 'IN', expectAuthorityPattern: /Azadi|DTAA/i },
  { id: 'cite-scc-2022-gst', category: 'case_law_citation', query: '(2022) 3 SCC 208 GST compensation cess', countryCode: 'IN', expectAuthorityPattern: /GST|Mohit/i },
  { id: 'cite-scc-2023-divorce-142', category: 'case_law_citation', query: '(2023) 8 SCC 324 divorce Article 142 irretrievable breakdown', countryCode: 'IN', expectAuthorityPattern: /Shilpa|142|breakdown/i },
  { id: 'cite-scc-2007-cruelty', category: 'case_law_citation', query: '(2007) 4 SCC 511 mental cruelty categories', countryCode: 'IN', expectAuthorityPattern: /Samar Ghosh|cruelty/i },
  { id: 'cite-scc-2008-chaturbhuj', category: 'case_law_citation', query: '(2008) 2 SCC 316 maintenance unable to maintain', countryCode: 'IN', expectAuthorityPattern: /Chaturbhuj|maintain/i },
  { id: 'negative-fake-scc', category: 'case_law_negative', query: '(2099) 99 SCC 99999 fake case', countryCode: 'IN', forbidInOutput: [/good law|binding precedent/i] },
  { id: 'negative-invented-air', category: 'case_law_negative', query: 'AIR 2099 SC 99999 invented case cite', countryCode: 'IN', forbidInOutput: [/AIR 2099 SC 99999.*binding/i] },
];

export const UMBRELLA_LEGAL_EVAL_WITH_CASE_LAW: GoldenEvalCase[] = [
  ...UMBRELLA_LEGAL_EVAL_V1,
  ...CASE_LAW_GOLDEN_EVAL,
];

export const DRAFT_ARCHETYPE_GOLDEN_CASES: DraftArchetypeGoldenCase[] = [
  {
    id: 'in-stalking-fir-minimal',
    jurisdiction: 'IN',
    caseDetails:
      'Mr K, 50, stalks Ms S, 19. They are neighbours. No relationship. She wants to file a police complaint.',
    offenceDate: '2025-01-10',
    expectKind: /india_fir_complaint/,
    expectSections: [
      { actId: 'bns', section: '78' },
      { actId: 'bnss', section: '173' },
    ],
    expectRegister: 'police_complaint',
    sampleDraft: `To, The Station House Officer, [BLANK: police station]
Complaint under BNS §78 read with BNSS §173.
Facts: neighbours; stalking allegation; no relationship.
Prayer: register FIR under BNSS §173 and investigate.`,
    forbidDraftPatterns: [
      /Hon'?ble\s+Police\s+Station/i,
      /MOST\s+RESPECTFULLY\s+SHOWETH/i,
      /non[-\s]?bailable/i,
      /must\s+arrest/i,
    ],
  },
  {
    id: 'in-theft-fir',
    jurisdiction: 'IN',
    caseDetails: 'Someone stole my motorcycle from outside my house. I want to file an FIR.',
    offenceDate: '2025-06-01',
    expectKind: /india_fir_complaint/,
    expectSections: [
      { actId: 'bns', section: '303' },
      { actId: 'bnss', section: '173' },
    ],
    expectRegister: 'police_complaint',
  },
  {
    id: 'in-ni138-magistrate',
    jurisdiction: 'IN',
    caseDetails: 'Cheque bounce under NI Act section 138. Statutory notice sent. Want to file complaint.',
    expectKind: /india_cheque_bounce_complaint_ni138/,
    expectSections: [{ actId: 'ni_act', section: '138' }],
    expectRegister: 'magistrate_complaint',
  },
  {
    id: 'in-dv-pwdva',
    jurisdiction: 'IN',
    caseDetails: 'Wife seeks protection under PWDVA domestic violence act from husband.',
    expectKind: /india_domestic_violence_petition/,
    expectRegister: 'protective_order',
  },
  {
    id: 'in-regular-bail',
    jurisdiction: 'IN',
    caseDetails: 'Accused arrested. Seek regular bail application before Magistrate.',
    expectKind: /india_regular_bail_bnss_480/,
    expectRegister: 'bail_application',
  },
  {
    id: 'in-bail-rohan-mehta-cyber-fraud',
    jurisdiction: 'IN',
    caseDetails: `Rohan Mehta v. State. FIR No. 42/2026 dated 17 February 2026, PS Cyber Crime.
Accused Rohan Mehta arrested 19 February 2026. Chargesheet filed 15 April 2026.
Co-accused granted bail. Defence: no CCTV produced; forensic imaging after seizure;
Wi-Fi / IP address alone insufficient; CDR issues; shopkeeper statement; intimidation;
cash recovery disputed. Seek regular bail under BNSS §480/§483.`,
    expectKind: /india_regular_bail_bnss_480/,
    expectRegister: 'bail_application',
    sampleDraft: `IN THE SESSIONS COURT
Applicant–Accused: Rohan Mehta
FIR dated 17 February 2026. Arrested 19 February 2026. Chargesheet filed under BNSS §193 on 15 April 2026.
GROUNDS FOR BAIL:
A) Bail is the rule — Satender Kumar Antil v. CBI (2022) 10 SCC 51.
B) CCTV not produced as stated in defence — Prasanta Kumar Sarkar v. Ashis Chatterjee (2010) 14 SCC 496.
C) Forensic imaging timeline — Sanjay Chandra v. CBI (2012) 1 SCC 40.
D) Parity with co-accused granted bail — Satender Kumar Antil v. CBI (2022) 10 SCC 51.
E) Wi-Fi / IP insufficiency — Arnesh Kumar v. State of Bihar (2014) 8 SCC 273.
PRAYER: Enlarge Applicant–Accused on bail.
VERIFICATION.`,
    forbidDraftPatterns: [
      /FIR\s+(?:dated|on)\s+19\s+February/i,
      /investigation\s+(?:is\s+)?(?:still\s+)?ongoing/i,
      /chargesheet.{0,40}(?:under|u\/s)\s*173\b/i,
      /\bPetitioner\b/i,
      /benefit\s+of\s+(?:the\s+)?doubt/i,
      /person\s+of\s+means/i,
      /\[AUTHORITY TO BE ADDED\]/i,
    ],
  },
  {
    id: 'in-anticipatory-bail',
    jurisdiction: 'IN',
    caseDetails: 'Accused fears arrest in non-bailable offence. Seek anticipatory bail BNSS 482.',
    expectKind: /india_anticipatory_bail/,
    expectRegister: 'bail_application',
  },
  {
    id: 'in-writ-hc',
    jurisdiction: 'IN',
    caseDetails: 'Challenge arbitrary state action by writ petition under Article 226 High Court.',
    expectKind: /india_writ/,
  },
  {
    id: 'in-ni-138',
    jurisdiction: 'IN',
    caseDetails: 'Cheque dishonoured for insufficient funds. File NI Act 138 complaint after legal notice.',
    expectKind: /india_cheque_dishonour|ni_act|138/,
  },
  {
    id: 'in-fir-cyber',
    jurisdiction: 'IN',
    caseDetails: 'Victim of online fraud wants to file FIR at police station under IT Act / BNS cheating.',
    expectKind: /india_fir_complaint/,
    expectRegister: 'police_complaint',
  },
  {
    id: 'in-discharge',
    jurisdiction: 'IN',
    caseDetails: 'Accused seeks discharge after chargesheet; no prima facie case under BNSS.',
    expectKind: /discharge|india_/,
  },
  {
    id: 'in-maintenance-revision',
    jurisdiction: 'IN',
    caseDetails: 'Challenge interim maintenance order under CrPC 125 / BNSS 144 by criminal revision.',
    expectKind: /india_maintenance_order_revision/,
    expectSections: [
      { actId: 'bnss', section: '144' },
      { actId: 'bnss', section: '438' },
    ],
    expectRegister: 'appellate',
  },
  {
    id: 'in-legal-notice-property',
    jurisdiction: 'IN',
    caseDetails: 'Send legal notice for unpaid rent and vacant possession of leased premises.',
    expectKind: /india_legal_notice|notice/,
  },
  {
    id: 'in-habeas',
    jurisdiction: 'IN',
    caseDetails: 'Family seeks habeas corpus for illegal detention without production before Magistrate.',
    expectKind: /habeas|writ/,
  },
  {
    id: 'in-slp',
    jurisdiction: 'IN',
    caseDetails: 'Special leave petition against High Court judgment in criminal appeal, Article 136.',
    expectKind: /slp|india_/,
  },
  {
    id: 'in-civil-plaint',
    jurisdiction: 'IN',
    caseDetails: 'File civil suit for permanent injunction restraining trespass on property.',
    expectKind: /plaint|suit|civil|india_/,
  },
  {
    id: 'in-commercial-summary-suit-recovery',
    jurisdiction: 'IN',
    caseDetails:
      'Claimant supplier seeks a commercial summary suit under Order XXXVII CPC in Ahmedabad for ₹25,00,000 outstanding under a written purchase order, three unpaid invoices, signed delivery challans, email and WhatsApp acknowledgments. Section 12A pre-institution mediation ended in a non-starter report.',
    documentKind: 'summary_suit_recovery',
    expectKind: /india_suit_recovery_cpc_37/,
    expectSections: [
      { actId: 'cpc', section: 'Order XXXVII' },
      { actId: 'commercial_courts_act', section: '12A' },
    ],
    expectRegister: 'civil_plaint',
    forbidDraftPatterns: [
      /marriage|matrimonial|maintenance/i,
      /criminal revision|\bFIR\b|\bbail\b/i,
      /\bSEBI\b|delisting/i,
      /set[-\s]?off|counter[-\s]?claim/i,
    ],
  },
  {
    id: 'in-magistrate-complaint',
    jurisdiction: 'IN',
    caseDetails: 'Private complaint to Magistrate under BNSS 223 for cheating.',
    expectKind: /magistrate|223|complaint/,
  },
  {
    id: 'in-criminal-appeal',
    jurisdiction: 'IN',
    caseDetails: 'Appeal against conviction by Sessions Court seeking acquittal.',
    expectKind: /appeal|india_/,
  },
  {
    id: 'us-stalking-restraining-order',
    jurisdiction: 'US',
    caseDetails: 'Neighbor stalking and harassing me. Need a restraining order.',
    expectKind: /us_state_restraining_order/,
    expectRegister: 'protective_order',
  },
  {
    id: 'us-assault-criminal-complaint',
    jurisdiction: 'US',
    caseDetails: 'Victim of assault and battery. File a state criminal complaint.',
    expectKind: /us_state_criminal_complaint/,
    expectRegister: 'police_complaint',
  },
  {
    id: 'us-federal-wire-fraud',
    jurisdiction: 'US',
    caseDetails: 'Federal wire fraud under 18 U.S.C. §1343 using interstate wires.',
    expectKind: /us_federal_criminal_complaint/,
  },
  {
    id: 'us-bail-motion',
    jurisdiction: 'US',
    caseDetails: 'Defendant seeks bail and pretrial release on bond in state court.',
    expectKind: /us_state_bail_motion/,
    expectRegister: 'bail_application',
  },
  {
    id: 'us-civil-breach',
    jurisdiction: 'US',
    caseDetails: 'Breach of contract civil complaint for money damages owed.',
    expectKind: /us_state_civil_complaint/,
    expectRegister: 'civil_plaint',
  },
  {
    id: 'us-police-complaint-routing',
    jurisdiction: 'US',
    caseDetails: 'police_complaint document kind routing check',
    documentKind: 'police_complaint',
    expectKind: /us_state_criminal_complaint/,
  },
];

@Injectable()
export class UmbrellaLegalEvalHarness {
  constructor(
    private readonly bareActLookup: BareActLookupService,
    private readonly substanceVerification: SubstanceVerificationService,
    private readonly citationFirstLookup: CitationFirstLookupService,
    private readonly hybridSearch: HybridSearchService,
  ) {}

  getGoldenCases(): GoldenEvalCase[] {
    return UMBRELLA_LEGAL_EVAL_WITH_CASE_LAW;
  }

  getDraftArchetypeGoldenCases(): DraftArchetypeGoldenCase[] {
    return DRAFT_ARCHETYPE_GOLDEN_CASES;
  }

  async runGoldenRetrievalBenchmark(): Promise<EvalBenchmarkResult> {
    let passed = 0;
    const details: Record<string, unknown> = {};

    const goldenCases = UMBRELLA_LEGAL_EVAL_WITH_CASE_LAW;
    for (const testCase of goldenCases) {
      const isCaseLawCategory = testCase.category.startsWith('case_law');
      let hits: Array<{ title: string; citation: string | null; summary: string | null; fullText?: string | null }> = [];

      if (isCaseLawCategory) {
        const citationHits = this.citationFirstLookup.isCitationQuery(testCase.query)
          ? await this.citationFirstLookup.lookup(testCase.query, testCase.countryCode)
          : [];
        const semanticHits = await this.hybridSearch.search(testCase.query, {
          countryCode: testCase.countryCode,
          limit: 5,
        });
        hits = [...citationHits, ...semanticHits];
      } else {
        hits = await this.bareActLookup.lookupSection(testCase.query, testCase.countryCode);
      }

      let casePassed = hits.length > 0;

      if (testCase.expectAuthorityPattern && hits.length > 0) {
        const text = hits.map((h) => `${h.title} ${h.citation} ${h.summary}`).join(' ');
        casePassed = testCase.expectAuthorityPattern.test(text);
      }

      if (testCase.expectInOutput && hits.length > 0) {
        const text = hits.map((h) => `${h.title} ${h.summary ?? ''}`).join(' ');
        casePassed =
          casePassed && testCase.expectInOutput.every((pattern) => pattern.test(text));
      }

      if (testCase.forbidInOutput && hits.length > 0) {
        const text = hits.map((h) => `${h.title} ${h.summary ?? ''}`).join(' ');
        casePassed =
          casePassed && !testCase.forbidInOutput.some((pattern) => pattern.test(text));
      }

      if (testCase.isBareActQuery && hits.length > 0) {
        const mockOutput = hits[0].fullText ?? hits[0].summary ?? '';
        const substance = this.substanceVerification.checkBareActSubstance({
          query: testCase.query,
          outputMarkdown: mockOutput,
          authorities: hits.map((h) => ({
            id: 'id' in h && h.id ? String(h.id) : h.title,
            title: h.title,
            citation: h.citation,
            summary: h.summary,
            fullText: h.fullText ?? null,
          })),
          isBareActQuery: true,
        });
        casePassed = casePassed && substance.passed;
      }

      if (casePassed) passed += 1;
      details[testCase.id] = { passed: casePassed, hitCount: hits.length };
    }

    const score = passed / goldenCases.length;
    return {
      name: 'umbrella_legal_eval_with_case_law',
      passed: score >= 0.85,
      score: Number(score.toFixed(4)),
      details: { total: goldenCases.length, passed, cases: details },
    };
  }

  runDraftNormalizerBenchmark(): EvalBenchmarkResult {
    const draftCase = UMBRELLA_LEGAL_EVAL_V1.find((c) => c.id === 'draft-maintenance-crpc125');
    const wrongText =
      'Section 125 of the Code of Criminal Procedure, 1973 (now Section 125 of the Bharatiya Nyaya Sanhita, 2023).';
    const normalized = normalizeIndiaDraftStatutes(wrongText, {
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Wife maintenance',
    });

    let passed = normalized.corrections.length > 0;
    if (draftCase?.expectInOutput) {
      passed = passed && draftCase.expectInOutput.every((re) => re.test(normalized.text));
    }
    if (draftCase?.forbidInOutput) {
      passed = passed && draftCase.forbidInOutput.every((re) => !re.test(normalized.text));
    }

    return {
      name: 'umbrella_legal_eval_draft_maintenance_crpc125',
      passed,
      score: passed ? 1 : 0,
      details: { corrections: normalized.corrections, output: normalized.text.slice(0, 200) },
    };
  }

  runDraftCitationStripBenchmark(): EvalBenchmarkResult {
    const fabricated = 'See AIR 1989 SC 1475 for the proposition.';
    const stripped = stripUnverifiedCitations(fabricated, []);
    const passed = stripped.stripped.length === 1 && !stripped.text.includes('AIR 1989 SC 1475');
    return {
      name: 'umbrella_legal_eval_draft_citation_strip',
      passed,
      score: passed ? 1 : 0,
      details: { stripped: stripped.stripped, output: stripped.text },
    };
  }

  runDraftArchetypeGoldenBenchmark(): EvalBenchmarkResult {
    const router = new DraftArchetypeRouterService();
    const legalRegister = new DraftLegalRegisterService(router);
    const factFidelity = new DraftFactFidelityService();
    const caseBrief = new DraftCaseBriefService();
    const timeline = new DraftProceduralTimelineValidator();
    const factCoverage = new DraftCaseFactCoverageService();
    let passed = 0;
    const details: Record<string, unknown> = {};

    for (const testCase of DRAFT_ARCHETYPE_GOLDEN_CASES) {
      let casePassed = true;
      const failures: string[] = [];

      if (testCase.id === 'us-police-complaint-routing') {
        const mapped = documentKindToDraftKind('police_complaint', 'US');
        if (!testCase.expectKind?.test(mapped)) {
          casePassed = false;
          failures.push(`documentKindToDraftKind expected ${testCase.expectKind}, got ${mapped}`);
        }
      } else {
        const route = router.route({
          jurisdiction: testCase.jurisdiction,
          caseDetails: testCase.caseDetails,
          documentKind: testCase.documentKind,
          offenceDate: testCase.offenceDate,
        });
        if (testCase.expectKind && !testCase.expectKind.test(route.recommendedKind ?? '')) {
          casePassed = false;
          failures.push(`kind: expected ${testCase.expectKind}, got ${route.recommendedKind}`);
        }
        if (testCase.expectRegister && route.register !== testCase.expectRegister) {
          casePassed = false;
          failures.push(`register: expected ${testCase.expectRegister}, got ${route.register}`);
        }
        for (const sec of testCase.expectSections ?? []) {
          const ok = route.governingSections.some(
            (s) =>
              s.actId.toLowerCase() === sec.actId.toLowerCase() &&
              s.section.toLowerCase() === sec.section.toLowerCase(),
          );
          if (!ok) {
            casePassed = false;
            failures.push(`missing section ${sec.actId} §${sec.section}`);
          }
        }
        if (testCase.sampleDraft && testCase.forbidDraftPatterns) {
          for (const re of testCase.forbidDraftPatterns) {
            if (re.test(testCase.sampleDraft)) {
              casePassed = false;
              failures.push(`sample draft matched forbid ${re}`);
            }
          }
          const regFindings = legalRegister.evaluate({
            draft: testCase.sampleDraft,
            kind: route.recommendedKind ?? 'india_fir_complaint',
            caseDetails: testCase.caseDetails,
            countryCode: testCase.jurisdiction,
            offenceDate: testCase.offenceDate,
          });
          const fidelity = factFidelity.evaluate({
            draft: testCase.sampleDraft,
            caseDetails: testCase.caseDetails,
          });
          // Good sample should not trip register blockers for police register language
          const badRegister = regFindings.some(
            (f) =>
              f.severity === 'BLOCKER' &&
              /honble_police|court_showeth|non_bailable|mandatory_in_fir/i.test(f.checkId),
          );
          if (badRegister) {
            casePassed = false;
            failures.push('sample draft failed legal-register blockers unexpectedly');
          }
          void fidelity;

          // Lawyer-ready gates for Rohan Mehta golden sample
          if (testCase.id === 'in-bail-rohan-mehta-cyber-fraud') {
            const brief = caseBrief.extract(
              testCase.caseDetails,
              'india_regular_bail_bnss_480',
            );
            const tl = timeline.evaluate({
              draft: testCase.sampleDraft,
              caseDetails: testCase.caseDetails,
              kind: 'india_regular_bail_bnss_480',
              brief,
            });
            const blockers = tl.filter((f) => f.severity === 'BLOCKER' && f.state !== 'PASS');
            if (blockers.length > 0) {
              casePassed = false;
              failures.push(`timeline blockers on good sample: ${blockers.map((b) => b.checkId).join(',')}`);
            }
            const cov = factCoverage.evaluate({
              draft: testCase.sampleDraft,
              brief,
              kind: 'india_regular_bail_bnss_480',
              filingGrade: true,
            });
            if (cov.coverageRate < 0.5) {
              casePassed = false;
              failures.push(`fact coverage too low: ${cov.coverageRate}`);
            }
            if (!/Applicant[-–]?Accused/i.test(testCase.sampleDraft)) {
              casePassed = false;
              failures.push('missing Applicant–Accused label');
            }
          }
        }
      }

      if (casePassed) passed += 1;
      details[testCase.id] = { passed: casePassed, failures };
    }

    const score = passed / DRAFT_ARCHETYPE_GOLDEN_CASES.length;
    return {
      name: 'umbrella_legal_eval_draft_archetype_matrix',
      passed: score >= 0.95,
      score: Number(score.toFixed(4)),
      details: {
        total: DRAFT_ARCHETYPE_GOLDEN_CASES.length,
        passed,
        cases: details,
      },
    };
  }

  runFalseVerifiedRateBenchmark(): EvalBenchmarkResult {
    const evidencePackService = new LegalEvidencePackService();
    const verifier = new ClaimLevelVerificationService(
      new AuthorityIdentityService(),
      new QuotationVerificationService(),
    );
    const pack = evidencePackService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'eval_bail_case',
          title: 'Eval Bail Case',
          citation: '(2024) 1 SCC 99',
          sourceName: 'Supreme Court of India',
          sourceTier: 'case_law',
          summary: 'Bail requires assessment of flight risk, antecedents, witness tampering, and gravity.',
        },
      ],
    });
    const result = verifier.verify({
      evidencePack: pack,
      jurisdiction: 'IN',
      draft: {
        directAnswer: { text: 'Eval', confidence: 0.5 },
        issues: [
          {
            issueId: 'eval_issue',
            heading: 'Eval',
            conclusion: 'Eval',
            propositions: [
              {
                claimId: 'fake_cite_wrong_holding',
                text: 'The Supreme Court held bail is mandatory in every criminal case.',
                type: 'HOLDING',
                evidenceIds: [pack.authorities[0].passages[0].evidenceId],
                confidence: 0.9,
              },
              {
                claimId: 'missing_evidence',
                text: 'A missing authority proves the proposition.',
                type: 'RULE',
                evidenceIds: ['missing_evidence_id'],
                confidence: 0.9,
              },
            ],
          },
        ],
        practicalSteps: [],
        limitations: [],
        unansweredQuestions: [],
      },
    });

    const falselyVerified = result.claimAudits.filter(
      (audit) =>
        ['fake_cite_wrong_holding', 'missing_evidence'].includes(audit.claimId) &&
        audit.passageSupport === 'SUPPORTED' &&
        audit.action === 'KEEP',
    ).length;
    const falseVerifiedRate = falselyVerified / 2;
    return {
      name: 'umbrella_legal_eval_false_verified_rate',
      passed: falseVerifiedRate === 0,
      score: Number((1 - falseVerifiedRate).toFixed(4)),
      details: {
        falseVerifiedRate,
        claimAudits: result.claimAudits,
        findings: result.findings,
      },
    };
  }

  runUpiResearchRegressionBenchmark(): EvalBenchmarkResult {
    const relevance = new RelevanceVerificationService();
    const offPointResults = UPI_OFF_POINT_AUTHORITIES.map((authority) =>
      relevance.assess({
        authority,
        query: UPI_REGRESSION_QUERY,
        legalDomain: 'CONSUMER',
      }),
    );
    const appropriateResults = UPI_CITATION_EVAL_OUTPUT.citations.map((citation) =>
      relevance.assess({
        authority: {
          title: citation.authority?.title,
          citation: citation.authority?.citation,
          fullText: citation.authority?.fullText,
          summary: citation.authority?.summary,
          practiceAreas: Array.isArray(citation.authority?.practiceAreas)
            ? citation.authority.practiceAreas.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined,
          topics: Array.isArray(citation.authority?.topics)
            ? citation.authority.topics.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined,
        },
        query: `${citation.quotedText ?? ''} ${citation.authority?.title ?? ''}`,
        legalDomain: 'CONSUMER',
      }),
    );
    const checklistGaps = checkDomainCompleteness({
      query: UPI_REGRESSION_QUERY,
      outputMarkdown: UPI_GOLDEN_RESEARCH_OUTPUT,
      countryCode: 'IN',
    });
    const citationMetrics = computeCitationEvalMetrics([UPI_CITATION_EVAL_OUTPUT]);
    const passed =
      offPointResults.every((result) => result.state === 'OFF_POINT') &&
      appropriateResults.every((result) => result.state !== 'OFF_POINT') &&
      checklistGaps.length === 0 &&
      citationMetrics.citationRelevanceScore >= 0.5 &&
      citationMetrics.citationMetadataCompletenessScore === 1;

    return {
      name: 'umbrella_legal_eval_upi_research',
      passed,
      score: passed ? 1 : 0,
      citationRelevanceScore: citationMetrics.citationRelevanceScore,
      citationMetadataCompletenessScore:
        citationMetrics.citationMetadataCompletenessScore,
      details: {
        offPointResults,
        appropriateResults,
        checklistGaps,
        evaluatedCitations: citationMetrics.evaluatedCitations,
      },
    };
  }

  runMatrimonialResearchGoldenBenchmark(): EvalBenchmarkResult {
    const results = MATRIMONIAL_RESEARCH_GOLDEN_CASES.map((testCase) => ({
      id: testCase.id,
      tier: testCase.tier,
      ...evaluateMatrimonialGoldenCase(testCase),
    }));
    const passedCount = results.filter((result) => result.passed).length;
    const score = passedCount / MATRIMONIAL_RESEARCH_GOLDEN_CASES.length;

    return {
      name: 'matrimonial_research_golden',
      passed: score === 1,
      score,
      details: {
        total: MATRIMONIAL_RESEARCH_GOLDEN_CASES.length,
        passed: passedCount,
        cases: results,
      },
    };
  }
}
