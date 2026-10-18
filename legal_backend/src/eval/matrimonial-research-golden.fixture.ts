export type MatrimonialGoldenIssue = {
  issueId: string;
  finding: 'PROVED' | 'UNPROVED' | 'MIXED' | 'NOT_APPLICABLE';
  evidenceStatus: 'SUPPORTED' | 'INCOMPLETE' | 'CONFLICTED';
  adverseAuthorityAddressed: boolean;
  condonationAddressed: boolean;
  pinpointStatus: 'COMPLETE' | 'GAP';
};

export type MatrimonialGoldenOutput = {
  calibration: 'HIGH' | 'MODERATE' | 'LOW';
  conclusion: 'RELIEF_LIKELY' | 'RELIEF_UNCERTAIN' | 'RELIEF_UNLIKELY';
  releaseState: 'READY_FOR_LAWYER' | 'LAWYER_REVIEW_REQUIRED';
  issues: MatrimonialGoldenIssue[];
};

export type MatrimonialResearchGoldenCase = {
  id: string;
  tier: 'happy' | 'edge' | 'hard';
  scenario: string;
  expected: {
    calibration: MatrimonialGoldenOutput['calibration'];
    conclusion: MatrimonialGoldenOutput['conclusion'];
    releaseState: MatrimonialGoldenOutput['releaseState'];
    issues: Array<
      Pick<
        MatrimonialGoldenIssue,
        | 'issueId'
        | 'finding'
        | 'evidenceStatus'
        | 'adverseAuthorityAddressed'
        | 'condonationAddressed'
        | 'pinpointStatus'
      >
    >;
  };
  candidate: MatrimonialGoldenOutput;
};

export const MATRIMONIAL_RESEARCH_GOLDEN_CASES: MatrimonialResearchGoldenCase[] = [
  {
    id: 'matrimonial-happy-calibrated-cruelty',
    tier: 'happy',
    scenario:
      'Contemporaneous medical records and admitted messages support repeated cruelty; no reconciliation followed.',
    expected: {
      calibration: 'HIGH',
      conclusion: 'RELIEF_LIKELY',
      releaseState: 'READY_FOR_LAWYER',
      issues: [
        {
          issueId: 'mental_cruelty',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
      ],
    },
    candidate: {
      calibration: 'HIGH',
      conclusion: 'RELIEF_LIKELY',
      releaseState: 'READY_FOR_LAWYER',
      issues: [
        {
          issueId: 'mental_cruelty',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
      ],
    },
  },
  {
    id: 'matrimonial-edge-good-faith-unproved-complaint',
    tier: 'edge',
    scenario:
      'A spouse made a police complaint in good faith, but the allegations were not proved; the record does not establish knowing falsity.',
    expected: {
      calibration: 'MODERATE',
      conclusion: 'RELIEF_UNCERTAIN',
      releaseState: 'READY_FOR_LAWYER',
      issues: [
        {
          issueId: 'unproved_complaint',
          finding: 'UNPROVED',
          evidenceStatus: 'INCOMPLETE',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
        {
          issueId: 'good_faith',
          finding: 'MIXED',
          evidenceStatus: 'CONFLICTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
      ],
    },
    candidate: {
      calibration: 'MODERATE',
      conclusion: 'RELIEF_UNCERTAIN',
      releaseState: 'READY_FOR_LAWYER',
      issues: [
        {
          issueId: 'unproved_complaint',
          finding: 'UNPROVED',
          evidenceStatus: 'INCOMPLETE',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
        {
          issueId: 'good_faith',
          finding: 'MIXED',
          evidenceStatus: 'CONFLICTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
      ],
    },
  },
  {
    id: 'matrimonial-hard-adverse-condonation-pinpoint-gaps',
    tier: 'hard',
    scenario:
      'The alleged cruelty predates resumed cohabitation; adverse authority and later condonation may defeat relief, and two propositions lack pinpoints.',
    expected: {
      calibration: 'LOW',
      conclusion: 'RELIEF_UNLIKELY',
      releaseState: 'LAWYER_REVIEW_REQUIRED',
      issues: [
        {
          issueId: 'condonation',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
        {
          issueId: 'adverse_authority',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'GAP',
        },
        {
          issueId: 'post_reconciliation_conduct',
          finding: 'UNPROVED',
          evidenceStatus: 'INCOMPLETE',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'GAP',
        },
      ],
    },
    candidate: {
      calibration: 'LOW',
      conclusion: 'RELIEF_UNLIKELY',
      releaseState: 'LAWYER_REVIEW_REQUIRED',
      issues: [
        {
          issueId: 'condonation',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'COMPLETE',
        },
        {
          issueId: 'adverse_authority',
          finding: 'PROVED',
          evidenceStatus: 'SUPPORTED',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'GAP',
        },
        {
          issueId: 'post_reconciliation_conduct',
          finding: 'UNPROVED',
          evidenceStatus: 'INCOMPLETE',
          adverseAuthorityAddressed: true,
          condonationAddressed: true,
          pinpointStatus: 'GAP',
        },
      ],
    },
  },
];

export function evaluateMatrimonialGoldenCase(
  testCase: MatrimonialResearchGoldenCase,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const { candidate, expected } = testCase;
  for (const field of ['calibration', 'conclusion', 'releaseState'] as const) {
    if (candidate[field] !== expected[field]) {
      failures.push(`${field}: expected ${expected[field]}, got ${candidate[field]}`);
    }
  }
  for (const expectedIssue of expected.issues) {
    const actual = candidate.issues.find(
      (issue) => issue.issueId === expectedIssue.issueId,
    );
    if (!actual) {
      failures.push(`missing issue ${expectedIssue.issueId}`);
      continue;
    }
    for (const field of [
      'finding',
      'evidenceStatus',
      'adverseAuthorityAddressed',
      'condonationAddressed',
      'pinpointStatus',
    ] as const) {
      if (actual[field] !== expectedIssue[field]) {
        failures.push(
          `${expectedIssue.issueId}.${field}: expected ${expectedIssue[field]}, got ${actual[field]}`,
        );
      }
    }
  }
  if (
    candidate.issues.some((issue) => issue.pinpointStatus === 'GAP') &&
    candidate.releaseState !== 'LAWYER_REVIEW_REQUIRED'
  ) {
    failures.push('pinpoint gaps must require lawyer review');
  }
  return { passed: failures.length === 0, failures };
}
