export type IndiaResearchBenchmarkCategory =
  | 'section_lookup'
  | 'case_lookup'
  | 'case_analysis'
  | 'case_comparison'
  | 'matter_opinion'
  | 'statute_interpretation'
  | 'procedure'
  | 'current_law_transition'
  | 'adverse_authority'
  | 'fake_citation_no_answer'
  | 'partnership_arbitration';

export type IndiaResearchAdversarialFailureCategory =
  | 'incorrect_plan'
  | 'missing_issue_dependency'
  | 'source_integrity_failure'
  | 'contrary_search_omission'
  | 'conflict_resolution_failure'
  | 'temporal_fidelity_failure'
  | 'fact_fidelity_failure'
  | 'unsupported_proposition'
  | 'confidence_miscalibration'
  | 'failure_to_abstain'
  | 'non_reproducible_result';

export interface BenchmarkAuthorityExpectation {
  key: string;
  aliases: readonly string[];
}

export interface IndiaResearchBenchmarkThresholds {
  precisionAt5: number;
  requiredAuthorityRecall: number;
  passageSupport: number;
  maxFalseVerificationRate: number;
  maxDomainContaminationRate: number;
  sourceAvailability: number;
  planCorrectness: number;
  issueDependencyCoverage: number;
  sourceIntegrity: number;
  contrarySearchCompletion: number;
  conflictFidelity: number;
  temporalFidelity: number;
  factFidelity: number;
  propositionSupport: number;
  confidenceCalibration: number;
  reproducibility: number;
  maxFirstDraftMs: number;
  maxTotalMs: number;
}

export interface IndiaResearchBenchmarkCase {
  id: string;
  taskKind:
    | 'SECTION_LOOKUP'
    | 'STATUTORY_INTERPRETATION'
    | 'CASE_LOOKUP'
    | 'CASE_SURVEY'
    | 'CASE_ANALYSIS'
    | 'CASE_COMPARISON'
    | 'CITATION_VERIFICATION'
    | 'CURRENT_LAW'
    | 'ADVERSE_AUTHORITY'
    | 'PROCEDURE'
    | 'GENERAL_RESEARCH'
    | 'MATTER_OPINION';
  category: IndiaResearchBenchmarkCategory;
  query: string;
  countryCode: 'IN';
  requiredAuthorities: readonly BenchmarkAuthorityExpectation[];
  relevantAuthorities: readonly BenchmarkAuthorityExpectation[];
  expectedDomains: readonly string[];
  currentLawTerms?: readonly string[];
  legacyLawTerms?: readonly string[];
  shouldAbstain?: boolean;
  adversarialFailureCategories: readonly IndiaResearchAdversarialFailureCategory[];
  thresholds: IndiaResearchBenchmarkThresholds;
}

const DEFAULT_THRESHOLDS: IndiaResearchBenchmarkThresholds = {
  precisionAt5: 0.4,
  requiredAuthorityRecall: 0.5,
  passageSupport: 1,
  maxFalseVerificationRate: 0,
  maxDomainContaminationRate: 0.2,
  sourceAvailability: 0.8,
  planCorrectness: 1,
  issueDependencyCoverage: 1,
  sourceIntegrity: 1,
  contrarySearchCompletion: 1,
  conflictFidelity: 1,
  temporalFidelity: 1,
  factFidelity: 1,
  propositionSupport: 1,
  confidenceCalibration: 0.75,
  reproducibility: 1,
  maxFirstDraftMs: 45_000,
  maxTotalMs: 90_000,
};

function authority(
  key: string,
  ...aliases: string[]
): BenchmarkAuthorityExpectation {
  return { key, aliases: [key, ...aliases] };
}

export const INDIA_RESEARCH_BENCHMARK_MANIFEST = [
  {
    id: 'case-survey-partnership-arbitration-enforcement',
    taskKind: 'CASE_SURVEY',
    category: 'partnership_arbitration',
    query:
      'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('vh-patel', 'V.H. Patel & Co. v. Hirubhai Himabhai Patel'),
      authority('jagdish-chander', 'Jagdish Chander v. Ramesh Chander'),
      authority('purushottam-anil', 'Purushottam v. Anil'),
    ],
    relevantAuthorities: [
      authority('partnership-act-section-69', 'Indian Partnership Act section 69'),
      authority('arbitration-act-section-11', 'Arbitration and Conciliation Act section 11'),
      authority('tarun-dhameja-2024', 'Tarun Dhameja'),
    ],
    expectedDomains: ['partnership', 'arbitration', 'dissolution', 'accounts'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'missing_issue_dependency',
      'contrary_search_omission',
      'source_integrity_failure',
      'unsupported_proposition',
      'confidence_miscalibration',
      'non_reproducible_result',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'case-comparison-arrest-safeguards',
    taskKind: 'CASE_COMPARISON',
    category: 'case_comparison',
    query:
      'Compare Arnesh Kumar and Satender Kumar Antil on arrest and bail safeguards for offences punishable up to seven years in India.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('arnesh-kumar', 'Arnesh Kumar v State of Bihar', '(2014) 8 SCC 273'),
      authority(
        'satender-kumar-antil',
        'Satender Kumar Antil v Central Bureau of Investigation',
        '(2022) 10 SCC 51',
      ),
    ],
    relevantAuthorities: [
      authority('bnss-section-35', 'Bharatiya Nagarik Suraksha Sanhita section 35'),
      authority('crpc-section-41a', 'Code of Criminal Procedure section 41A'),
    ],
    expectedDomains: ['criminal', 'arrest', 'bail', 'bnss', 'crpc'],
    currentLawTerms: ['BNSS', 'section 35'],
    legacyLawTerms: ['CrPC', 'section 41A'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'missing_issue_dependency',
      'contrary_search_omission',
      'conflict_resolution_failure',
      'temporal_fidelity_failure',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'statute-interpretation-arbitration-limitation',
    taskKind: 'STATUTORY_INTERPRETATION',
    category: 'statute_interpretation',
    query:
      'Interpret section 34(3) of the Arbitration and Conciliation Act, 1996: when does limitation begin and can delay beyond the additional thirty days be condoned?',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('arbitration-act-section-34-3', 'Arbitration and Conciliation Act section 34(3)'),
      authority(
        'union-of-india-v-popular-construction',
        'Union of India v Popular Construction Co',
        '(2001) 8 SCC 470',
      ),
    ],
    relevantAuthorities: [
      authority('tecco-trichy', 'Union of India v Tecco Trichy Engineers', '(2005) 4 SCC 239'),
    ],
    expectedDomains: ['arbitration', 'limitation'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'missing_issue_dependency',
      'source_integrity_failure',
      'unsupported_proposition',
      'fact_fidelity_failure',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'procedure-fir-quashing-transition',
    taskKind: 'PROCEDURE',
    category: 'procedure',
    query:
      'What is the present procedure and Supreme Court test for quashing an FIR in India after the BNSS replaced the CrPC?',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('bnss-section-528', 'Bharatiya Nagarik Suraksha Sanhita section 528'),
      authority(
        'state-of-haryana-v-bhajan-lal',
        'State of Haryana v Bhajan Lal',
        '1992 Supp (1) SCC 335',
      ),
    ],
    relevantAuthorities: [
      authority('crpc-section-482', 'Code of Criminal Procedure section 482'),
      authority('neeha-infrastructure', 'Neeharika Infrastructure v State of Maharashtra'),
    ],
    expectedDomains: ['criminal', 'procedure', 'fir', 'bnss', 'crpc'],
    currentLawTerms: ['BNSS', 'section 528'],
    legacyLawTerms: ['CrPC', 'section 482'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'missing_issue_dependency',
      'contrary_search_omission',
      'temporal_fidelity_failure',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'current-law-electronic-evidence',
    taskKind: 'CURRENT_LAW',
    category: 'current_law_transition',
    query:
      'Explain the current Indian law for proving an electronic record, including the transition from Evidence Act section 65B to the Bharatiya Sakshya Adhiniyam.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('bsa-section-63', 'Bharatiya Sakshya Adhiniyam section 63', 'BSA section 63'),
      authority(
        'arjun-panditrao-khotkar',
        'Arjun Panditrao Khotkar v Kailash Kushanrao Gorantyal',
        '(2020) 7 SCC 1',
      ),
    ],
    relevantAuthorities: [
      authority('evidence-act-section-65b', 'Indian Evidence Act section 65B'),
    ],
    expectedDomains: ['evidence', 'electronic evidence', 'bsa'],
    currentLawTerms: ['Bharatiya Sakshya Adhiniyam', 'section 63', '1 July 2024'],
    legacyLawTerms: ['Evidence Act', 'section 65B'],
    adversarialFailureCategories: [
      'source_integrity_failure',
      'conflict_resolution_failure',
      'temporal_fidelity_failure',
      'fact_fidelity_failure',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'adverse-unstamped-arbitration-agreement',
    taskKind: 'ADVERSE_AUTHORITY',
    category: 'adverse_authority',
    query:
      'Identify the strongest adverse authority to an argument that an unstamped contract makes its arbitration agreement unenforceable in India, and explain the current position.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority(
        'in-re-interplay',
        'In Re Interplay Between Arbitration Agreements and the Indian Stamp Act',
        '2023 INSC 1066',
      ),
      authority('nn-global', 'N N Global Mercantile v Indo Unique Flame', 'N.N. Global'),
    ],
    relevantAuthorities: [
      authority('arbitration-act-section-11', 'Arbitration and Conciliation Act section 11'),
      authority('stamp-act', 'Indian Stamp Act'),
    ],
    expectedDomains: ['arbitration', 'stamp', 'contract'],
    currentLawTerms: ['seven-judge', 'curative', 'separable'],
    legacyLawTerms: ['N.N. Global', 'five-judge'],
    adversarialFailureCategories: [
      'contrary_search_omission',
      'conflict_resolution_failure',
      'temporal_fidelity_failure',
      'unsupported_proposition',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'fake-citation-verification',
    taskKind: 'CITATION_VERIFICATION',
    category: 'fake_citation_no_answer',
    query:
      'Verify and explain the holding in Ramesh Kumar v Union of India, (2025) 14 SCC 999, said to create an absolute right to anticipatory bail.',
    countryCode: 'IN',
    requiredAuthorities: [],
    relevantAuthorities: [],
    expectedDomains: ['criminal', 'bail'],
    shouldAbstain: true,
    adversarialFailureCategories: [
      'source_integrity_failure',
      'unsupported_proposition',
      'confidence_miscalibration',
      'failure_to_abstain',
      'non_reproducible_result',
    ],
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      precisionAt5: 0,
      requiredAuthorityRecall: 1,
      sourceAvailability: 0,
    },
  },
  {
    id: 'partnership-arbitration-nonregistration',
    taskKind: 'GENERAL_RESEARCH',
    category: 'partnership_arbitration',
    query:
      'Can a partner in an unregistered Indian partnership invoke arbitration for dissolution, accounts, and realization of partnership property despite section 69 of the Partnership Act?',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('partnership-act-section-69', 'Indian Partnership Act section 69'),
      authority(
        'umesh-goel',
        'Umesh Goel v Himachal Pradesh Cooperative Group Housing Society',
        '(2016) 11 SCC 313',
      ),
    ],
    relevantAuthorities: [
      authority('partnership-act-section-69-3-a', 'Partnership Act section 69(3)(a)'),
      authority('arbitration-act-section-11', 'Arbitration and Conciliation Act section 11'),
    ],
    expectedDomains: ['partnership', 'arbitration', 'dissolution', 'accounts'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'missing_issue_dependency',
      'contrary_search_omission',
      'fact_fidelity_failure',
      'unsupported_proposition',
      'confidence_miscalibration',
      'non_reproducible_result',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'section-lookup-arbitration-section-seven',
    taskKind: 'SECTION_LOOKUP',
    category: 'section_lookup',
    query:
      'Provide the operative text of section 7 of the Arbitration and Conciliation Act, 1996 as of 28 July 2026, with version and commencement metadata.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('arbitration-act-section-7', 'Arbitration and Conciliation Act section 7'),
    ],
    relevantAuthorities: [],
    expectedDomains: ['arbitration', 'arbitration agreement'],
    adversarialFailureCategories: [
      'source_integrity_failure',
      'temporal_fidelity_failure',
      'unsupported_proposition',
      'non_reproducible_result',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'case-lookup-kesavananda',
    taskKind: 'CASE_LOOKUP',
    category: 'case_lookup',
    query:
      'Locate and verify the full judgment and canonical citation for Kesavananda Bharati v State of Kerala.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority(
        'kesavananda-bharati',
        'Kesavananda Bharati v State of Kerala',
        '(1973) 4 SCC 225',
      ),
    ],
    relevantAuthorities: [],
    expectedDomains: ['constitutional', 'basic structure'],
    adversarialFailureCategories: [
      'source_integrity_failure',
      'unsupported_proposition',
      'confidence_miscalibration',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'case-analysis-puttaswamy',
    taskKind: 'CASE_ANALYSIS',
    category: 'case_analysis',
    query:
      'Analyse Justice K.S. Puttaswamy (Retd.) v Union of India: issues, holding, separate opinions, disposition, and later treatment.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority(
        'puttaswamy-privacy',
        'Justice K.S. Puttaswamy (Retd.) v Union of India',
        '(2017) 10 SCC 1',
      ),
    ],
    relevantAuthorities: [],
    expectedDomains: ['constitutional', 'privacy', 'fundamental rights'],
    adversarialFailureCategories: [
      'incorrect_plan',
      'source_integrity_failure',
      'conflict_resolution_failure',
      'unsupported_proposition',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
  {
    id: 'matter-opinion-consumer-limitation',
    taskKind: 'MATTER_OPINION',
    category: 'matter_opinion',
    query:
      'Advise, using only supplied facts, whether a consumer complaint filed more than two years after the transaction may proceed where the client alleges continuing concealment.',
    countryCode: 'IN',
    requiredAuthorities: [
      authority('consumer-protection-act-limitation', 'Consumer Protection Act limitation'),
    ],
    relevantAuthorities: [],
    expectedDomains: ['consumer', 'limitation', 'continuing cause'],
    adversarialFailureCategories: [
      'missing_issue_dependency',
      'fact_fidelity_failure',
      'contrary_search_omission',
      'confidence_miscalibration',
      'failure_to_abstain',
      'non_reproducible_result',
    ],
    thresholds: DEFAULT_THRESHOLDS,
  },
] as const satisfies readonly IndiaResearchBenchmarkCase[];

export type IndiaResearchBenchmarkManifestCase = IndiaResearchBenchmarkCase;

export const INDIA_RESEARCH_ADVERSARIAL_FIXTURES = [
  ['right-case-wrong-holding', 'CASE_ANALYSIS', 'ABSTAIN'],
  ['right-citation-wrong-court', 'CITATION_VERIFICATION', 'ABSTAIN'],
  ['same-party-names-different-case', 'CASE_LOOKUP', 'ABSTAIN'],
  ['interim-order-as-final', 'CASE_ANALYSIS', 'PARTIAL'],
  ['party-submission-as-holding', 'CASE_ANALYSIS', 'ABSTAIN'],
  ['dissent-as-majority', 'CASE_ANALYSIS', 'ABSTAIN'],
  ['headnote-conflicts-with-judgment', 'CASE_ANALYSIS', 'ABSTAIN'],
  ['incomplete-judgment-missing-disposition', 'CASE_LOOKUP', 'GAP'],
  ['fabricated-pinpoint', 'CITATION_VERIFICATION', 'ABSTAIN'],
  ['repealed-section-same-number', 'SECTION_LOOKUP', 'ABSTAIN'],
  ['renumbered-provision', 'STATUTORY_INTERPRETATION', 'PARTIAL'],
  ['amendment-not-commenced', 'CURRENT_LAW', 'ABSTAIN'],
  ['old-statute-applied-to-new', 'CURRENT_LAW', 'ABSTAIN'],
  ['coordinate-bench-conflict', 'ADVERSE_AUTHORITY', 'PARTIAL'],
  ['larger-bench-conflict', 'CASE_COMPARISON', 'PARTIAL'],
  ['unsupported-fact-application', 'MATTER_OPINION', 'GAP'],
  ['secondary-source-misquotation', 'GENERAL_RESEARCH', 'ABSTAIN'],
  ['later-authority-silently-limits', 'ADVERSE_AUTHORITY', 'PARTIAL'],
  ['correct-principle-wrong-jurisdiction', 'PROCEDURE', 'ABSTAIN'],
] as const satisfies readonly [
  id: string,
  taskKind: IndiaResearchBenchmarkCase['taskKind'],
  expectedDecision: 'VERIFIED' | 'PARTIAL' | 'GAP' | 'ABSTAIN',
][];
