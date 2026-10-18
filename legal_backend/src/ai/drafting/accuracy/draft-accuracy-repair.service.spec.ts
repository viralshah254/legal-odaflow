import { DraftAccuracyRepairService } from './draft-accuracy-repair.service';
import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import type { CaseRecord } from '../contracts/case-record';
import {
  buildSourceHash,
  createCaseRecordId,
} from '../contracts/case-record';

function baseCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    metadata: {
      caseRecordId: createCaseRecordId(),
      version: 1,
      status: 'confirmed',
      extractedAt: new Date().toISOString(),
      sourceHash: buildSourceHash('riya'),
      playbookId: 'india_consumer_complaint',
      playbookVersion: '1.0.0',
    },
    jurisdiction: {
      countryCode: 'IN',
      stateOrRegion: 'Gujarat',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    },
    parties: [
      { id: 'p1', role: 'complainant', name: 'Riya Desai' },
      { id: 'p2', role: 'opposite_party', name: 'SecureCare Health Insurance Co. Ltd.' },
      { id: 'p3', role: 'opposite_party', name: 'Sunrise Multispeciality Hospital' },
    ],
    facts: [
      {
        id: 'FACT_surgery',
        proposition: 'Laparoscopic gallbladder surgery on 11 March 2025',
        sourceQuote: 'On 11 March 2025 Dr. Anil Trivedi performed laparoscopic gallbladder',
        sourceType: 'user_input',
        status: 'prosecution_allegation',
        confidence: 'explicit',
        userApproved: true,
      },
    ],
    chronology: [
      {
        id: 'c1',
        label: 'Surgery / cholecystectomy',
        date: '11 March 2025',
        datePrecision: 'exact',
        factIds: ['FACT_surgery'],
      },
    ],
    evidence: [],
    moneyRecords: [
      {
        id: 'm1',
        kind: 'expense',
        amount: 180000,
        currency: 'INR',
        amountLabel: '₹1,80,000',
        description: 'Additional medical expenses',
        confirmationState: 'user_confirmed',
      },
    ],
    statutes: [],
    suggestedStatutes: [],
    contradictions: [],
    missingFields: [],
    matterData: {},
    ...overrides,
  };
}

describe('DraftAccuracyRepairService (deterministic)', () => {
  const svc = new DraftAccuracyRepairService();

  it('corrects SecurCare entity spelling globally', async () => {
    const draft =
      'The Opposite Party SecurCare denied coverage. SecurCare is liable.';
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH,
          severity: 'blocker',
          message: 'SecurCare mismatch',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.changed).toBe(true);
    expect(result.draftText).not.toMatch(/SecurCare/i);
    expect(result.draftText).toMatch(/SecureCare/);
    expect(result.appliedFindingCodes).toContain(
      ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH,
    );
  });

  it('fills known blanks from CaseRecord money/date/party', async () => {
    const draft =
      'Complainant [BLANK] incurred expenses of [BLANK] after surgery dated [BLANK].';
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
          severity: 'blocker',
          message: 'blanks',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.changed).toBe(true);
    expect(result.draftText).not.toMatch(/\[BLANK\]/i);
  });

  it('remaps wrong CPA sections and stale 1986 act', async () => {
    const draft =
      'Under the Consumer Protection Act, 1986 Section 2(1)(h) and Section 2(18) deficiency arose.';
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message: 'wrong section',
        },
        {
          code: ACCURACY_BLOCKER_CODES.STALE_STATUTE,
          severity: 'blocker',
          message: 'stale',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.draftText).toMatch(/Consumer Protection Act, 2019/);
    expect(result.draftText).toMatch(/Section 34|§34|Section 2\(16\)/);
    expect(result.draftText).not.toMatch(/1986/);
  });

  it('removes invented insurer denial paragraphs', async () => {
    const draft = [
      'FACTS',
      'The surgery caused bile duct injury.',
      '',
      'The insurer repudiated the claim in bad faith and denied coverage without reason.',
      '',
      'PRAYER',
      'Grant compensation.',
    ].join('\n');
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL,
          severity: 'blocker',
          message: 'invented denial',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.draftText.toLowerCase()).not.toMatch(/repudiat|bad faith/);
    expect(result.draftText).toMatch(/bile duct injury/);
  });

  it('strips pleading sections from research memo WRONG_DOCUMENT_KIND', async () => {
    const draft = [
      'LEGAL RESEARCH MEMORANDUM',
      'ISSUES',
      'Whether negligence is made out.',
      'CAUSE TITLE',
      'BEFORE THE DISTRICT COMMISSION',
      'PRAYER',
      'Award damages.',
      'VERIFICATION',
      'I verify everything.',
    ].join('\n');
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: 'WRONG_DOCUMENT_KIND',
          severity: 'blocker',
          message:
            'A research memorandum was requested, but the generated output contains pleading-only sections.',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.draftText).not.toMatch(/CAUSE TITLE|PRAYER|VERIFICATION/i);
    expect(result.draftText).toMatch(/ISSUES/);
  });

  it('qualifies disputed facts stated as admitted', async () => {
    const draft = 'Negligence is established beyond doubt and is admitted.';
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord(),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED,
          severity: 'blocker',
          message: 'disputed as admitted',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.draftText.toLowerCase()).toMatch(/alleged|subject to proof/);
    expect(result.draftText.toLowerCase()).not.toMatch(/beyond doubt/);
  });

  it('fills labeled blanks from CaseRecord chronology', async () => {
    const draft =
      'Consent was obtained on [BLANK: consent date]. Surgery on [BLANK: surgery date].';
    const result = await svc.repair({
      draftText: draft,
      caseRecord: baseCaseRecord({
        chronology: [
          {
            id: 'c0',
            label: 'Consent',
            date: '10 March 2025',
            datePrecision: 'exact',
            factIds: [],
          },
          {
            id: 'c1',
            label: 'Surgery / cholecystectomy',
            date: '11 March 2025',
            datePrecision: 'exact',
            factIds: ['FACT_surgery'],
          },
        ],
      }),
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
          severity: 'blocker',
          message: 'Known consent and surgery dates left blank',
        },
      ],
      allowSemanticRepair: false,
    });
    expect(result.draftText).toContain('10 March 2025');
    expect(result.draftText).toContain('11 March 2025');
  });
});
