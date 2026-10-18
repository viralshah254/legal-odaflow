import { AgenticResearchLoopService } from './agentic-research-loop.service';
import type { LlmCompletionService } from '@/ai/llm-completion.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  IssueCoverageMatrix,
  ResearchIntelligenceMap,
} from './research-intelligence-map.types';

const authority = (over: Partial<RetrievedAuthority>): RetrievedAuthority =>
  ({
    id: 'a1',
    title: 'Some Authority',
    citation: '(2020) 1 SCC 1',
    summary: '',
    fullText: '',
    sourceTier: 'case_law',
    ...over,
  }) as RetrievedAuthority;

const map = (): ResearchIntelligenceMap =>
  ({
    issues: [
      { id: 'issue-1', label: 'Whether bail may be granted' },
      { id: 'issue-2', label: 'Whether the arrest was lawful' },
    ],
    researchQueries: [],
    contraryAuthorityQueries: [],
    degraded: false,
  }) as unknown as ResearchIntelligenceMap;

const matrix = (over: Partial<IssueCoverageMatrix> = {}): IssueCoverageMatrix => ({
  cells: [
    { issueId: 'issue-1', issueLabel: 'Bail', law: true, cases: false, current: true, contrary: false },
    { issueId: 'issue-2', issueLabel: 'Arrest', law: false, cases: false, current: true, contrary: false },
  ],
  redCells: [],
  complete: false,
  loopsRun: 0,
  ...over,
});

describe('AgenticResearchLoopService', () => {
  const makeService = (llm: Partial<LlmCompletionService>) =>
    new AgenticResearchLoopService(llm as LlmCompletionService);

  const baseInput = {
    query: 'Is bail available and was the arrest lawful?',
    countryCode: 'IN',
    map: map(),
    authorities: [],
    attemptedQueries: [],
    plannerModel: 'planner',
    maxHops: 3,
  };

  describe('assessCoverage', () => {
    it('falls back to deterministic coverage gaps when the planner is not consulted', async () => {
      const service = makeService({
        isModelConfigured: jest.fn(),
        complete: jest.fn(),
      });

      const result = await service.assessCoverage({
        ...baseInput,
        consultPlanner: false,
        matrix: matrix({
          redCells: [
            { issueId: 'issue-2', dimension: 'law', suggestedQueries: ['arrest safeguards statute'] },
          ],
        }),
      });

      expect(result.degraded).toBe(false);
      expect(result.sufficient).toBe(false);
      expect(result.hops).toEqual([
        expect.objectContaining({ query: 'arrest safeguards statute', origin: 'coverage-matrix' }),
      ]);
    });

    it('spreads deterministic hops across sub-issues instead of exhausting one', async () => {
      const service = makeService({ isModelConfigured: jest.fn(), complete: jest.fn() });

      const result = await service.assessCoverage({
        ...baseInput,
        consultPlanner: false,
        maxHops: 4,
        matrix: matrix({
          redCells: [
            { issueId: 'issue-1', dimension: 'cases', suggestedQueries: ['q1', 'q2', 'q3', 'q4'] },
            { issueId: 'issue-2', dimension: 'law', suggestedQueries: ['q5'] },
          ],
        }),
      });

      expect(result.hops.map((h) => h.query)).toEqual(['q1', 'q2', 'q5']);
    });

    it('reports degraded when the planner model is unavailable', async () => {
      const service = makeService({
        isModelConfigured: jest.fn().mockReturnValue(false),
        complete: jest.fn(),
      });

      const result = await service.assessCoverage({
        ...baseInput,
        consultPlanner: true,
        matrix: matrix(),
      });

      expect(result.degraded).toBe(true);
    });

    it('turns the planner verdict into de-duplicated, jurisdiction-neutral hops', async () => {
      const complete = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          sufficient: false,
          unresolved: ['No authority on the lawfulness of the arrest.'],
          next: [
            {
              query: 'arrest safeguards leading judgment',
              purpose: 'case',
              issueId: 'issue-2',
              rationale: 'No case decides issue 2.',
            },
            { query: 'already tried', purpose: 'case', issueId: null, rationale: 'dupe' },
            { query: 'x', purpose: 'case', issueId: null, rationale: 'too short' },
          ],
        }),
      });
      const service = makeService({
        isModelConfigured: jest.fn().mockReturnValue(true),
        complete,
      });

      const result = await service.assessCoverage({
        ...baseInput,
        countryCode: 'GB',
        jurisdiction: 'England and Wales',
        consultPlanner: true,
        attemptedQueries: ['already tried'],
        matrix: matrix(),
      });

      expect(result.degraded).toBe(false);
      expect(result.hops).toEqual([
        expect.objectContaining({
          query: 'arrest safeguards leading judgment',
          issueId: 'issue-2',
          origin: 'planner',
        }),
      ]);
      expect(result.unresolved).toEqual(['No authority on the lawfulness of the arrest.']);
      const prompt = complete.mock.calls[0][0].messages[1].content as string;
      expect(prompt).toContain('England and Wales');
    });

    it('never lets the planner declare sufficiency while hops remain open', async () => {
      const service = makeService({
        isModelConfigured: jest.fn().mockReturnValue(true),
        complete: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            sufficient: true,
            unresolved: [],
            next: [{ query: 'one more thing to read', purpose: 'statute', rationale: 'gap' }],
          }),
        }),
      });

      const result = await service.assessCoverage({
        ...baseInput,
        consultPlanner: true,
        matrix: matrix(),
      });

      expect(result.sufficient).toBe(false);
      expect(result.hops).toHaveLength(1);
    });

    it('degrades safely when the planner call throws', async () => {
      const service = makeService({
        isModelConfigured: jest.fn().mockReturnValue(true),
        complete: jest.fn().mockRejectedValue(new Error('boom')),
      });

      const result = await service.assessCoverage({
        ...baseInput,
        consultPlanner: true,
        matrix: matrix({ complete: true }),
      });

      expect(result.degraded).toBe(true);
      expect(result.sufficient).toBe(true);
    });
  });

  describe('citationGraphHops', () => {
    const service = () => makeService({ isModelConfigured: jest.fn(), complete: jest.fn() });

    it('follows case names cited inside retrieved sources, in any jurisdiction', () => {
      const hops = service().citationGraphHops(
        [
          authority({
            id: 'us-1',
            title: 'Some US opinion',
            fullText:
              'As held in Brown v. Board of Education, and reaffirmed in Brown v. Board of Education, segregation is unlawful.',
          }),
          authority({
            id: 'uk-1',
            title: 'Some UK judgment',
            fullText: 'The principle in Donoghue v Stevenson applies.',
          }),
        ],
        { limit: 5 },
      );

      expect(hops.map((h) => h.query)).toEqual([
        'Brown v Board of Education judgment',
        'Donoghue v Stevenson judgment',
      ]);
      expect(hops[0].origin).toBe('citation-graph');
    });

    it('does not chase a case already in the pack or a statute reference', () => {
      const hops = service().citationGraphHops(
        [
          authority({
            id: 'in-1',
            title: 'Arnesh Kumar v. State of Bihar',
            fullText:
              'Arnesh Kumar v. State of Bihar considered Section 41 v Section 41A of the Code.',
          }),
        ],
        { limit: 5 },
      );

      expect(hops).toEqual([]);
    });

    it('respects the attempted-query list', () => {
      const hops = service().citationGraphHops(
        [authority({ fullText: 'See Donoghue v Stevenson for the rule.' })],
        { limit: 5, attemptedQueries: ['Donoghue v Stevenson judgment'] },
      );

      expect(hops).toEqual([]);
    });
  });

  describe('checklistHops', () => {
    it('converts unmet domain requirements into retrieval hops', () => {
      const service = makeService({ isModelConfigured: jest.fn(), complete: jest.fn() });

      const hops = service.checklistHops(
        [
          {
            id: 'current_law_version',
            label: 'Current-law version and treatment qualification',
            retrievalTarget: 'Retrieve the operative statutory version.',
          },
        ],
        { query: 'Is section 6 still in force?', limit: 2 },
      );

      expect(hops).toEqual([
        expect.objectContaining({
          origin: 'domain-checklist',
          rationale: 'Retrieve the operative statutory version.',
        }),
      ]);
    });
  });
});
