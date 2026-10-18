import { DraftPlanningService } from '@/ai/unified-drafting/planning/draft-planning.service';
import type { BuildPlanInput } from '@/ai/unified-drafting/planning/draft-planning.service';

function minimalPlanInput(documentKind: string): BuildPlanInput {
  return {
    jobId: 'job_test',
    matter: {
      documentKind,
      jurisdiction: 'IN',
      facts: [{ id: 'F1', statement: 'Consent on 10 March 2025', status: 'confirmed', source: 'user' }],
      parties: [{ role: 'other', name: 'Riya Desai' }],
      dates: [],
      requestedRelief: [],
      proceduralEvents: [],
      assertions: [],
      missingInputs: [],
      rawUserInput: 'Medical negligence consumer matter',
    } as unknown as BuildPlanInput['matter'],
    proceduralResult: {
      status: 'pass',
      passed: true,
      issues: [],
      proceduralProfile: { mandatoryNotices: [] },
    } as unknown as BuildPlanInput['proceduralResult'],
    sourceRegistry: { sources: [{ id: 'SRC_1', title: 'CPA 2019', verificationStatus: 'verified' }] } as unknown as BuildPlanInput['sourceRegistry'],
    qualityTier: 'standard',
    tenantId: 'tenant_1',
    userId: 'user_1',
  };
}

describe('DraftPlanningService — research memo template', () => {
  it('falls back to memo sections for india_legal_research_memo', async () => {
    const llm = { complete: jest.fn().mockRejectedValue(new Error('planner unavailable')) };
    const modelRouter = {
      scoreComplexity: () => ({ total: 55 }),
      resolvePlannerModel: () => 'gpt-4.1-mini',
    };
    const service = new DraftPlanningService(llm as never, modelRouter as never);

    const plan = await service.buildPlan(minimalPlanInput('india_legal_research_memo'));
    const titles = plan.sections.map((s) => s.title);

    expect(titles).toEqual([
      'SHORT ANSWER',
      'ISSUES',
      'FACTS',
      'ANALYSIS',
      'AUTHORITIES',
      'NEXT STEPS',
    ]);
    expect(titles.some((t) => /cause title|prayer|verification/i.test(t))).toBe(false);
  });

  it('falls back to strategy memo sections for india_case_strategy_memo', async () => {
    const llm = { complete: jest.fn().mockRejectedValue(new Error('planner unavailable')) };
    const modelRouter = {
      scoreComplexity: () => ({ total: 55 }),
      resolvePlannerModel: () => 'gpt-4.1-mini',
    };
    const service = new DraftPlanningService(llm as never, modelRouter as never);

    const plan = await service.buildPlan(minimalPlanInput('india_case_strategy_memo'));
    const titles = plan.sections.map((s) => s.title);

    expect(titles[0]).toBe('CASE THESIS');
    expect(titles).toContain('EVIDENCE PLAN');
    expect(titles).toContain('RISKS');
  });
});
