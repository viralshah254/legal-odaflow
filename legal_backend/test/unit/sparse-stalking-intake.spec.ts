import {
  extractMatterFacts,
  hasBns78Citation,
  parseCitedStatutes,
} from '@/ai/draft-intent/matter-fact-extractor';
import {
  isStalkingComplaintQuery,
  resolveDocumentBundle,
  STALKING_COMPLAINT_BUNDLE,
} from '@/ai/draft-intent/draft-intent-bundles';
import { resolveCuratedDraftLabel } from '@/ai/draft-intent/draft-intent.helpers';
import { MatterClarificationService } from '@/ai/draft-intent/matter-clarification.service';

const SPARSE_STALKING = `
Mr k and ms s are neighbours
Mr k - 50 years old
Ms s - 19 years old

Mr k stalks ms s
And they have no relationship

Ms s wants to file a complaint against mr k.. section 78 bns is what you should look at
`.trim();

describe('sparse stalking intake signals', () => {
  it('detects stalking allegation, sparse facts, and BNS §78 citation', () => {
    const facts = extractMatterFacts(SPARSE_STALKING);
    expect(facts.hasStalkingAllegation).toBe(true);
    expect(facts.isSparseAllegation).toBe(true);
    expect(facts.hasOnlineConduct).toBe(false);
    expect(hasBns78Citation(facts.citedStatutes)).toBe(true);
    expect(parseCitedStatutes(SPARSE_STALKING).some((c) => c.actId === 'bns' && c.section === '78')).toBe(
      true,
    );
  });

  it('emits stalking fact questions for sparse allegations', () => {
    const service = new MatterClarificationService();
    const extracted = extractMatterFacts(SPARSE_STALKING);
    const questions = service.buildContextualQuestions(
      SPARSE_STALKING,
      {
        practiceArea: 'litigation_disputes',
        subPracticeArea: 'criminal_complaint_filing',
        confidence: 0.9,
      } as any,
      { documentKind: 'police_complaint', documentKindConfidence: 'high' } as any,
      extracted,
    );
    expect(questions.map((q) => q.id)).toEqual([
      'stalking_conduct',
      'stalking_frequency',
      'stalking_evidence',
      'stalking_aggravation',
    ]);
  });

  it('returns FIR + magistrate bundle without cyber when no online facts', () => {
    expect(isStalkingComplaintQuery(SPARSE_STALKING)).toBe(true);
    const bundle = resolveDocumentBundle(undefined, SPARSE_STALKING);
    expect(bundle?.map((b) => b.kind)).toEqual([
      'india_fir_complaint',
      'india_complaint_magistrate_bnss_223',
    ]);
    expect(bundle).toHaveLength(STALKING_COMPLAINT_BUNDLE.length);
  });

  it('includes cyber when online conduct is present', () => {
    const online = `${SPARSE_STALKING}\nHe monitors her Instagram and WhatsApp.`;
    const bundle = resolveDocumentBundle(undefined, online);
    expect(bundle?.map((b) => b.kind)).toContain('india_cyber_crime_complaint');
  });

  it('labels FIR draft with BNS §78', () => {
    const { label, proceduralNote } = resolveCuratedDraftLabel(
      'police_complaint',
      'india_fir_complaint',
      SPARSE_STALKING,
    );
    expect(label).toMatch(/BNS §78/);
    expect(proceduralNote).toMatch(/BNSS §173/);
  });
});
