import type { NormalizedMatter } from '../contracts/normalized-matter';
import { UnifiedProceduralGateService } from './unified-procedural-gate.service';

const makeMatter = (overrides: Partial<NormalizedMatter> = {}): NormalizedMatter => ({
  id: 'matter-summary-suit',
  jurisdiction: 'IN-DL',
  documentKind: 'india_suit_recovery_cpc_37',
  court: {
    name: 'Commercial Court, Delhi',
    jurisdiction: 'IN-DL',
    level: 'district',
    city: 'Delhi',
  },
  parties: [
    { role: 'plaintiff', name: 'Apex Private Limited' },
    { role: 'defendant', name: 'Zenith Private Limited' },
  ],
  facts: [
    {
      id: 'fact-invoice',
      statement:
        'Invoice INV-17 dated 1 January 2026 for Rs.12,50,000 fell due on 31 January 2026 under the written purchase order.',
      status: 'confirmed',
      source: 'user',
      date: '2026-01-01',
    },
    {
      id: 'fact-mediation',
      statement:
        'Pre-institution mediation under Section 12A was filed on 1 April 2026 and a non-starter report issued on 20 April 2026.',
      status: 'confirmed',
      source: 'user',
      date: '2026-04-01',
    },
    {
      id: 'fact-fee',
      statement:
        'Suit valuation is Rs.12,50,000 and court fee will be paid ad valorem under the applicable Delhi schedule.',
      status: 'confirmed',
      source: 'user',
    },
  ],
  dates: [
    {
      id: 'date-due',
      label: 'Invoice due date',
      date: '2026-01-31',
      factIds: ['fact-invoice'],
    },
  ],
  requestedRelief: [
    { id: 'relief-decree', description: 'Decree for Rs.12,50,000', type: 'primary' },
  ],
  proceduralHistory: [],
  userAssertions: [],
  missingInputs: [],
  contradictions: [],
  sourceDocumentIds: [],
  rawUserInput:
    'File an Order XXXVII commercial summary suit on the written purchase order and invoice.',
  normalizedAt: '2026-07-27T00:00:00.000Z',
  ...overrides,
});

describe('UnifiedProceduralGateService commercial summary suit', () => {
  const gate = new UnifiedProceduralGateService();

  it('passes a matter with written debt, amount, forum, dates, fee and Section 12A facts', async () => {
    const result = await gate.check(makeMatter());

    expect(result.status).toBe('pass');
    expect(result.proceduralProfile.governingProcedure).toEqual(
      expect.arrayContaining([
        'CPC Order XXXVII Rules 1–2 (summary procedure)',
        'Commercial Courts Act, 2015 (including Section 12A and Statement of Truth)',
      ]),
    );
    expect(result.proceduralProfile.mandatoryNotices?.join(' ')).toContain('Section 12A');
  });

  it('blocks absent written-debt and amount facts and warns on forum and Section 12A', async () => {
    const result = await gate.check(
      makeMatter({
        court: {
          name: 'District Court, Delhi',
          jurisdiction: 'IN-DL',
          level: 'district',
          city: 'Delhi',
        },
        facts: [],
        dates: [],
        requestedRelief: [],
        rawUserInput: 'Recover unpaid business dues from the defendant.',
      }),
    );
    const messages = result.issues.map((issue) => issue.message).join(' ');

    expect(result.status).toBe('blocked');
    expect(messages).toContain('Order XXXVII maintainability is not established');
    expect(messages).toContain('No claim amount found');
    expect(messages).toContain('Section 12A status is missing');
    expect(messages).toContain('not designated as a Commercial Court');
    expect(messages).toContain('No dates found');
  });

  it('does not treat an unsupported interim-injunction phrase as sufficient urgency', async () => {
    const result = await gate.check(
      makeMatter({
        facts: [
          {
            id: 'fact-invoice',
            statement:
              'A written invoice debt of Rs.12,50,000 is due and the plaint asks for an interim injunction.',
            status: 'alleged',
            source: 'user',
          },
          {
            id: 'fact-fee',
            statement: 'Valuation and court fee are to be computed under the Delhi schedule.',
            status: 'confirmed',
            source: 'user',
          },
        ],
        rawUserInput: 'File the commercial summary suit with an interim injunction.',
      }),
    );

    expect(result.issues.map((issue) => issue.message).join(' ')).toContain(
      'An interim prayer alone does not establish the Section 12A exception',
    );
  });
});
