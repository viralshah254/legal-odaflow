import { DraftRepairConfirmationService } from './draft-repair-confirmation.service';
import {
  buildSourceHash,
  createCaseRecordId,
  type CaseRecord,
} from '../contracts/case-record';

function caseRecord(): CaseRecord {
  return {
    metadata: {
      caseRecordId: createCaseRecordId(),
      version: 2,
      status: 'draft',
      extractedAt: new Date().toISOString(),
      sourceHash: buildSourceHash('conf'),
      playbookId: 'pb',
      playbookVersion: '1',
    },
    jurisdiction: { countryCode: 'IN', courtName: 'Unknown Forum' },
    parties: [],
    facts: [],
    chronology: [
      { id: 'c1', label: 'Surgery', date: '11 March 2025', factIds: [] },
    ],
    evidence: [],
    moneyRecords: [
      {
        id: 'm1',
        kind: 'claim',
        amountLabel: '₹1,00,000',
        description: 'claim amount',
        confirmationState: 'extracted',
      },
    ],
    statutes: [],
    suggestedStatutes: [],
    contradictions: [
      {
        id: 'x1',
        factId1: 'a',
        factId2: 'b',
        field: 'date',
        description: 'conflict',
        severity: 'blocker',
      },
    ],
    missingFields: [],
    matterData: {},
  };
}

describe('DraftRepairConfirmationService', () => {
  const svc = new DraftRepairConfirmationService();

  it('bumps CaseRecord version and applies date/amount/forum answers', () => {
    const result = svc.applyAnswers(caseRecord(), [
      { findingCode: 'DATE_CORRUPTION', field: 'date', value: '11 March 2025' },
      { findingCode: 'AMOUNT_CORRUPTION', field: 'amount', value: '₹1,80,000' },
      {
        findingCode: 'WRONG_FORUM',
        field: 'forum',
        value: 'District Consumer Disputes Redressal Commission, Ahmedabad',
      },
    ]);

    expect(result.versionBumped).toBe(true);
    expect(result.caseRecord.metadata.version).toBe(3);
    expect(result.caseRecord.metadata.status).toBe('confirmed');
    expect(result.caseRecord.jurisdiction.courtName).toMatch(/Ahmedabad/);
    expect(result.appliedFields).toEqual(
      expect.arrayContaining(['date', 'amount', 'forum']),
    );
    expect(result.caseRecord.contradictions[0].resolution).toBeTruthy();
  });

  it('deduplicates confirmation questions', () => {
    const qs = svc.buildQuestionsFromConflicts([
      { findingCode: 'A', field: 'date', question: 'q1' },
      { findingCode: 'A', field: 'date', question: 'q1-dup' },
      { findingCode: 'B', field: 'amount', question: 'q2' },
    ]);
    expect(qs).toHaveLength(2);
  });
});
