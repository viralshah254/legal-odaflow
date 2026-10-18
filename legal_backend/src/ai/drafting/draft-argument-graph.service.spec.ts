import { DraftArgumentGraphService } from './draft-argument-graph.service';
import type { DraftCaseTheory } from './draft-case-theory.service';
import type { VerifiedSource } from '@/ai/unified-drafting/contracts/verified-source';

const source = (over: Partial<VerifiedSource>): VerifiedSource => ({
  id: 'src-1',
  type: 'case',
  jurisdiction: 'IN',
  title: 'Some Case',
  verificationStatus: 'verified',
  contentHash: 'hash',
  ...over,
});

const theory = (grounds: DraftCaseTheory['grounds']): DraftCaseTheory => ({
  thesis: '',
  issues: [],
  grounds,
  favourableFacts: [],
  weaknesses: [],
  adversaryArguments: [],
  rebuttals: [],
  reliefStrategy: '',
  degraded: false,
});

describe('DraftArgumentGraphService', () => {
  const service = new DraftArgumentGraphService();

  it('binds each ground to the authorities that actually match it', () => {
    const graph = service.build({
      theory: theory([
        {
          id: 'g1',
          label: 'Prolonged pretrial detention',
          supportingFacts: [],
          authorityNeed: 'authority on prolonged incarceration awaiting trial',
        },
        {
          id: 'g2',
          label: 'Arrest was unnecessary',
          supportingFacts: [],
          authorityNeed: 'authority on arrest necessity',
        },
      ]),
      sources: [
        source({
          id: 'detention-case',
          title: 'Detention Authority',
          proposition: 'Prolonged incarceration awaiting trial violates liberty.',
        }),
        source({
          id: 'arrest-case',
          title: 'Arrest Authority',
          proposition: 'Arrest must be necessary; mechanical arrest is impermissible.',
        }),
      ],
    });

    expect(graph.nodes[0].authorityIds).toEqual(['detention-case']);
    expect(graph.nodes[1].authorityIds).toEqual(['arrest-case']);
    expect(graph.unsupportedGroundIds).toEqual([]);
  });

  it('marks a ground with no matching authority instead of borrowing one', () => {
    const graph = service.build({
      theory: theory([
        { id: 'g1', label: 'Limitation has expired', supportingFacts: [], authorityNeed: 'limitation period' },
      ]),
      sources: [source({ id: 'unrelated', title: 'Trespass Authority', proposition: 'Trespass requires entry.' })],
    });

    expect(graph.nodes[0].authorityGap).toBe(true);
    expect(graph.nodes[0].authorityIds).toEqual([]);
    expect(graph.unsupportedGroundIds).toEqual(['g1']);
    expect(graph.unallocatedSourceIds).toEqual(['unrelated']);
  });

  it('never binds a rejected source', () => {
    const graph = service.build({
      theory: theory([
        { id: 'g1', label: 'Limitation expired', supportingFacts: [], authorityNeed: 'limitation period' },
      ]),
      sources: [
        source({
          id: 'rejected-case',
          title: 'Limitation Authority',
          proposition: 'The limitation period runs from accrual.',
          verificationStatus: 'rejected',
        }),
      ],
    });

    expect(graph.nodes[0].authorityGap).toBe(true);
  });

  it('pulls in matter facts for grounds the theory left unattributed', () => {
    const graph = service.build({
      theory: theory([
        { id: 'g1', label: 'No recovery was effected', supportingFacts: [], authorityNeed: '' },
      ]),
      sources: [],
      facts: ['Nothing was recovered from the applicant.', 'The applicant is employed locally.'],
    });

    expect(graph.nodes[0].facts).toEqual(['Nothing was recovered from the applicant.']);
  });

  it('instructs an authority-gap marker for unsupported grounds in the prompt block', () => {
    const graph = service.build({
      theory: theory([
        { id: 'g1', label: 'Limitation expired', supportingFacts: ['Suit filed late'], authorityNeed: '' },
      ]),
      sources: [],
    });

    const block = service.buildPromptBlock(graph, []);

    expect(block).toContain('[AUTHORITY GAP]');
    expect(block).toContain('Do not supply a case name from memory');
    expect(block).toContain('fact: Suit filed late');
  });
});
