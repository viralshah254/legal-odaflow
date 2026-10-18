import { DraftCaseTheoryService } from './draft-case-theory.service';
import type { LlmCompletionService } from '@/ai/llm-completion.service';
import type { DraftCaseBrief } from './draft-case-brief.types';

const brief = (over: Partial<DraftCaseBrief> = {}): DraftCaseBrief =>
  ({
    parties: [{ role: 'accused', name: 'A. Kumar' }],
    proceduralHistory: {},
    proceduralStage: 'investigation',
    prosecutionFacts: ['Alleged to have received stolen goods.'],
    defenceFacts: ['No recovery was made from the accused.'],
    evidenceItems: [],
    contradictions: [],
    citedOffences: [],
    requiredGrounds: ['No recovery from the accused'],
    draftingConstraints: [],
    blanks: {},
    intakeIncomplete: false,
    missingCriticalFields: [],
    rawSummary: 'Bail application for A. Kumar.',
    extractedAt: new Date().toISOString(),
    ...over,
  }) as DraftCaseBrief;

describe('DraftCaseTheoryService', () => {
  const makeService = (llm: Partial<LlmCompletionService>) =>
    new DraftCaseTheoryService(llm as LlmCompletionService);

  const baseInput = {
    facts: 'The accused was arrested on suspicion of receiving stolen property. Nothing was recovered.',
    documentKind: 'bail_application',
    countryCode: 'IN',
    model: 'drafter',
    filingGrade: true,
  };

  it('does not spend a model call on non-filing-grade documents', async () => {
    const complete = jest.fn();
    const service = makeService({ isModelConfigured: jest.fn().mockReturnValue(true), complete });

    const theory = await service.build({
      ...baseInput,
      filingGrade: false,
      caseBrief: brief(),
    });

    expect(complete).not.toHaveBeenCalled();
    expect(theory.degraded).toBe(true);
    expect(theory.grounds.map((g) => g.label)).toEqual(['No recovery from the accused']);
  });

  it('falls back to the brief-derived theory when the model is unavailable', async () => {
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    });

    const theory = await service.build({ ...baseInput, caseBrief: brief() });

    expect(theory.degraded).toBe(true);
    expect(theory.favourableFacts).toEqual(['No recovery was made from the accused.']);
  });

  it('builds a full theory and keeps ground-to-issue links only for real issues', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        thesis: 'No recovery, no possession, no offence.',
        issues: [{ id: 'issue-possession', label: 'Possession', elements: ['Conscious possession'] }],
        grounds: [
          {
            id: 'ground-1',
            label: 'No recovery from the accused',
            issueId: 'issue-possession',
            supportingFacts: ['Nothing was recovered'],
            authorityNeed: 'authority that possession must be proved by recovery',
          },
          {
            id: 'ground-2',
            label: 'Delay in arrest',
            issueId: 'issue-that-does-not-exist',
            supportingFacts: [],
            authorityNeed: 'authority on arrest necessity',
          },
        ],
        favourableFacts: ['Clean antecedents'],
        weaknesses: ['Co-accused named him'],
        adversaryArguments: ['Statement of co-accused'],
        rebuttals: [{ argument: 'Co-accused statement', response: 'Not substantive evidence' }],
        reliefStrategy: 'Bail on conditions.',
      }),
    });
    const service = makeService({ isModelConfigured: jest.fn().mockReturnValue(true), complete });

    const theory = await service.build({
      ...baseInput,
      jurisdiction: 'Delhi',
      caseBrief: brief(),
    });

    expect(theory.degraded).toBe(false);
    expect(theory.thesis).toBe('No recovery, no possession, no offence.');
    expect(theory.grounds[0].issueId).toBe('issue-possession');
    expect(theory.grounds[1].issueId).toBeUndefined();
    const system = complete.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain('Delhi');
    expect(system).toContain('Name no authorities');
  });

  it('derives one retrieval query per ground and issue', async () => {
    const service = makeService({ isModelConfigured: jest.fn(), complete: jest.fn() });

    const queries = service.buildAuthorityQueries(
      {
        thesis: '',
        issues: [{ id: 'i1', label: 'Unlawful arrest', elements: [] }],
        grounds: [
          { id: 'g1', label: 'No recovery', supportingFacts: [], authorityNeed: 'possession requires recovery' },
          { id: 'g2', label: 'Arrest was unnecessary', supportingFacts: [], authorityNeed: '' },
        ],
        favourableFacts: [],
        weaknesses: [],
        adversaryArguments: [],
        rebuttals: [],
        reliefStrategy: '',
        degraded: false,
      },
      { documentKind: 'bail_application', jurisdiction: 'England and Wales' },
    );

    expect(queries).toEqual([
      'possession requires recovery England and Wales',
      'Arrest was unnecessary England and Wales',
      'Unlawful arrest England and Wales legal test',
    ]);
  });

  it('states in the prompt block that the theory does not license citations', async () => {
    const service = makeService({ isModelConfigured: jest.fn(), complete: jest.fn() });

    const block = service.buildPromptBlock({
      thesis: 'Thesis',
      issues: [{ id: 'i1', label: 'Issue one', elements: ['Element A'] }],
      grounds: [{ id: 'g1', label: 'Ground one', issueId: 'i1', supportingFacts: ['Fact A'], authorityNeed: '' }],
      favourableFacts: [],
      weaknesses: ['A weakness'],
      adversaryArguments: [],
      rebuttals: [{ argument: 'They say X', response: 'We say Y' }],
      reliefStrategy: 'Seek bail',
      degraded: false,
    });

    expect(block).toContain('Element A');
    expect(block).toContain('They say X');
    expect(block).toContain('Cite no authority unless it appears in the verified sources');
  });
});
