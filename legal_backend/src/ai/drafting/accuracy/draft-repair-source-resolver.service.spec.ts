import { DraftRepairSourceResolverService } from './draft-repair-source-resolver.service';
import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import {
  buildSourceHash,
  createCaseRecordId,
  type CaseRecord,
} from '../contracts/case-record';

function caseRecord(): CaseRecord {
  return {
    metadata: {
      caseRecordId: createCaseRecordId(),
      version: 1,
      status: 'confirmed',
      extractedAt: new Date().toISOString(),
      sourceHash: buildSourceHash('src'),
      playbookId: 'india_consumer_complaint',
      playbookVersion: '1',
    },
    jurisdiction: {
      countryCode: 'IN',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    },
    parties: [{ id: 'p1', role: 'complainant', name: 'Riya Desai', aliases: ['R. Desai'] }],
    facts: [
      {
        id: 'f1',
        proposition: 'Surgery on 11 March 2025',
        sourceQuote: 'surgery',
        sourceType: 'user_input',
        status: 'prosecution_allegation',
        confidence: 'explicit',
        userApproved: true,
      },
      {
        id: 'f2',
        proposition: 'Alternate date claimed as 12 March 2025',
        sourceQuote: 'alternate',
        sourceType: 'user_input',
        status: 'disputed',
        confidence: 'explicit',
      },
    ],
    chronology: [
      { id: 'c1', label: 'Surgery', date: '11 March 2025', factIds: ['f1'] },
      { id: 'c2', label: 'Alternate surgery date', date: '12 March 2025', factIds: ['f2'] },
    ],
    evidence: [],
    moneyRecords: [
      {
        id: 'm1',
        kind: 'expense',
        amountLabel: '₹1,80,000',
        description: 'Medical expenses',
        confirmationState: 'user_confirmed',
      },
    ],
    statutes: [{ id: 's1', actId: 'IN-CPA-2019', section: '35', raw: 'complaint', charged: true }],
    suggestedStatutes: [],
    contradictions: [
      {
        id: 'x1',
        factId1: 'f1',
        factId2: 'f2',
        field: 'date',
        description: 'Conflicting surgery dates',
        severity: 'blocker',
      },
    ],
    missingFields: [],
    matterData: {},
  };
}

describe('DraftRepairSourceResolverService', () => {
  const svc = new DraftRepairSourceResolverService();

  it('resolves facts, CPA statutes, forum profile, and conflicts', () => {
    const sources = svc.resolve({
      caseRecord: caseRecord(),
      draftText: 'Consumer complaint under CPA alleging deficiency.',
      findings: [
        {
          code: ACCURACY_BLOCKER_CODES.DATE_CORRUPTION,
          severity: 'blocker',
          message: 'Conflicting dates',
        },
      ],
    });

    expect(sources.facts.some((f) => f.value === 'Riya Desai')).toBe(true);
    expect(sources.facts.some((f) => f.field.startsWith('money.'))).toBe(true);
    expect(sources.statutes.some((s) => s.section === '2(16)' || s.section === '34')).toBe(true);
    expect(sources.forum?.forumName).toMatch(/Consumer/i);
    expect(sources.courtProfile?.id).toBe('in-district-consumer-ahmedabad');
    expect(sources.unresolvedConflicts.length).toBeGreaterThan(0);
  });

  it('filters unverified authorities', () => {
    const sources = svc.resolve({
      caseRecord: caseRecord(),
      draftText: 'Authority cited.',
      findings: [],
      verifiedAuthorities: [
        { citation: 'Good case', verified: true, proposition: 'ratio' },
        { citation: 'Bad case', verified: false },
      ],
    });
    expect(sources.authorities).toHaveLength(1);
    expect(sources.authorities[0].citation).toBe('Good case');
  });
});
