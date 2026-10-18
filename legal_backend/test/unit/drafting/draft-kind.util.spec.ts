import {
  hasConsumerMatterSignals,
  isResearchMemoKind,
  resolveBundleResearchMemoKind,
  resolveResearchMemoAccuracyMode,
} from '@/ai/drafting/draft-kind.util';
import { RIYA_INTAKE } from '@/ai/drafting/accuracy/riya-intake.fixture';

describe('draft-kind.util', () => {
  it('detects research memo kinds', () => {
    expect(isResearchMemoKind('india_legal_research_memo')).toBe(true);
    expect(isResearchMemoKind('india_consumer_research_memo')).toBe(true);
    expect(isResearchMemoKind('india_consumer_complaint')).toBe(false);
  });

  it('detects consumer medical signals from intake', () => {
    expect(hasConsumerMatterSignals('india_legal_research_memo', RIYA_INTAKE)).toBe(true);
  });

  it('uses balanced accuracy for research memos with confirmed case record', () => {
    expect(
      resolveResearchMemoAccuracyMode({
        documentKind: 'india_legal_research_memo',
        confirmedCaseRecord: { parties: [] },
        filingGrade: false,
      }),
    ).toBe('balanced');
  });

  it('routes bundle Doc 1 research memo to consumer variant for medical intake', () => {
    expect(resolveBundleResearchMemoKind('india_legal_research_memo', RIYA_INTAKE)).toBe(
      'india_consumer_research_memo',
    );
    expect(
      resolveBundleResearchMemoKind('india_legal_research_memo', 'Contract interpretation issue'),
    ).toBe('india_legal_research_memo');
  });
});
