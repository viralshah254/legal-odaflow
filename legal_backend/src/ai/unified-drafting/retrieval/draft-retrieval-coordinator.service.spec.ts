// p-limit is ESM-only and is pulled in transitively by the retrieval orchestrator,
// which this spec only needs as a stubbed collaborator.
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));

import { DraftRetrievalCoordinator } from './draft-retrieval-coordinator.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import type { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import type { NormalizedMatter } from '../contracts/normalized-matter';
import type { ProceduralGateResult } from '../procedural/unified-procedural-gate.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

const matter = (): NormalizedMatter =>
  ({
    documentKind: 'bail_application',
    jurisdiction: 'IN',
    rawUserInput:
      'Bail application for the accused arrested under the Bharatiya Nyaya Sanhita. Nothing was recovered.',
    facts: [{ statement: 'Nothing was recovered from the accused.' }],
  }) as unknown as NormalizedMatter;

// Quoteable shape: the check pack only admits case authorities that carry a real
// source URL and enough retrieved text to quote.
const authority = (id: string, title: string): RetrievedAuthority =>
  ({
    id,
    title,
    citation: `(2020) 1 SCC ${id.length}`,
    summary:
      'Bail is the rule and jail the exception; the court must consider the nature of the accusation, the antecedents of the accused, and the risk of the accused absconding before refusing liberty.',
    sourceUrl: `https://example-reports.test/${id}`,
    sourceTier: 'case_law',
    authorityType: 'CASE',
  }) as RetrievedAuthority;

describe('DraftRetrievalCoordinator', () => {
  const build = (retrieve: jest.Mock) =>
    new DraftRetrievalCoordinator(
      { retrieve } as unknown as LegalRetrievalOrchestrator,
      new DraftCaseBriefService(),
      new DraftKindPlaybookService(),
    );

  const baseInput = {
    matter: matter(),
    proceduralResult: {} as ProceduralGateResult,
    tenantId: 't1',
    userId: 'u1',
  };

  it('searches each per-ground query rather than only the fact-pattern query', async () => {
    const retrieve = jest.fn().mockResolvedValue({ authorities: [] });
    const coordinator = build(retrieve);

    await coordinator.retrieveAll({
      ...baseInput,
      groundQueries: [
        'authority that possession requires recovery India',
        'authority on arrest necessity India',
      ],
    });

    const issued = retrieve.mock.calls.map((call) => call[0].query as string);
    expect(issued).toEqual(
      expect.arrayContaining([
        'authority that possession requires recovery India',
        'authority on arrest necessity India',
      ]),
    );
  });

  it('treats saved research as a seed and still runs live search', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      authorities: [authority('live-1', 'Live Bail Authority')],
    });
    const coordinator = build(retrieve);

    const sources = await coordinator.retrieveAll({
      ...baseInput,
      savedResearchAuthorities: [authority('saved-1', 'Saved Bail Authority')],
      groundQueries: ['authority on arrest necessity India'],
    });

    expect(retrieve).toHaveBeenCalled();
    const ids = sources.map((s) => s.id);
    expect(ids).toContain('saved-1');
    expect(ids).toContain('live-1');
  });

  it('does not duplicate a source that both saved research and live search returned', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      authorities: [authority('shared', 'Shared Authority')],
    });
    const coordinator = build(retrieve);

    const sources = await coordinator.retrieveAll({
      ...baseInput,
      savedResearchAuthorities: [authority('shared', 'Shared Authority')],
    });

    expect(sources.filter((s) => s.id === 'shared')).toHaveLength(1);
  });
});
