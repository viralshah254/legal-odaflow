import { IkEvidenceIngestService } from './ik-evidence-ingest.service';
import { LegalEvidencePackService } from './legal-evidence-pack.service';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';

describe('IkEvidenceIngestService', () => {
  const packService = new LegalEvidencePackService();
  const queryBuilder = new IndiaKanoonQueryBuilderService();

  it('plans issue + statute + procedural queries', () => {
    const connector = { isConfigured: () => false, search: jest.fn() };
    const service = new IkEvidenceIngestService(connector as never, packService, queryBuilder);
    const plan = service.planQueries({
      query: 'BNS 351 intimidation bail',
      practiceArea: 'criminal',
      jurisdiction: 'Delhi',
    });
    expect(plan.issueQuery).toContain('doctypes:judgments');
    expect(plan.bindingQuery).toContain('doctypes:supremecourt');
    expect(plan.allQueries.length).toBeGreaterThan(0);
  });

  it('merges IK cases into evidence pack without marking verified', async () => {
    const connector = {
      isConfigured: () => true,
      search: jest.fn().mockResolvedValue([
        {
          id: 'ik-99',
          title: 'State v Accused',
          citation: '(2024) 1 SCC 10',
          court: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/99/',
          summary: 'Bail requires flight risk assessment.',
          judges: [],
          decisionDate: new Date('2024-01-01'),
          fullText:
            'The Supreme Court held that bail requires flight risk assessment and witness tampering analysis before grant of bail.',
          treatmentHint: 'followed',
          passages: [
            {
              text: 'The Supreme Court held that bail requires flight risk assessment and witness tampering analysis before grant of bail.',
              paragraph: '42',
              sourcePinpoint: true,
            },
          ],
        },
      ]),
      fetchDocFragment: jest.fn().mockResolvedValue(
        'The Supreme Court held that bail requires flight risk assessment and witness tampering analysis.',
      ),
    };
    const service = new IkEvidenceIngestService(connector as never, packService, queryBuilder);
    const { authorities, packDelta } = await service.retrieveAndIngest({
      query: 'bail flight risk',
      limitPerQuery: 2,
    });
    expect(authorities[0].id).toBe('ik-99');
    expect(authorities[0].sourceTier).toBe('case_law');
    expect(authorities[0].relevanceGate).toBe('admitted');
    expect(authorities[0].relevanceScore).toBeGreaterThan(0);
    expect(authorities[0].relevanceReason).toContain('admitted');
    expect(packDelta[0].passages.length).toBeGreaterThan(0);
    expect(packDelta[0].passages[0].paragraph).toBe('42');

    const base = packService.buildFromAuthorities({ jurisdiction: 'IN', authorities: [] });
    const merged = service.mergeIntoPack(base, packDelta);
    expect(merged.authorities.some((a) => a.authorityId === 'ik-99')).toBe(true);
    expect(merged.sourceSnapshots.some((s) => s.authorityId === 'ik-99')).toBe(true);
  });

  it('keeps quote fallback passages unnumbered instead of inventing judicial paragraphs', async () => {
    const connector = {
      isConfigured: () => true,
      search: jest.fn().mockResolvedValue([
        {
          id: 'ik-100',
          title: 'Claimant v State',
          citation: '(2024) 2 SCC 20',
          court: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/100/',
          summary: 'A source excerpt concerning bail safeguards and witness intimidation.',
          judges: [],
          decisionDate: new Date('2024-02-01'),
          fullText: 'A source excerpt concerning bail safeguards and witness intimidation.',
          treatmentHint: null,
          passages: [
            {
              text: 'A source excerpt concerning bail safeguards and witness intimidation.',
              sourcePinpoint: false,
            },
          ],
        },
      ]),
      fetchDocFragment: jest
        .fn()
        .mockResolvedValue('A source excerpt concerning bail safeguards and witness intimidation.'),
    };
    const service = new IkEvidenceIngestService(
      connector as never,
      packService,
      queryBuilder,
    );

    const result = await service.retrieveAndIngest({
      query: 'bail safeguards witness intimidation',
    });

    expect(result.packDelta[0].passages[0].paragraph).toBeUndefined();
  });

  it('rejects off-topic IK candidates before admission or pack creation', async () => {
    const connector = {
      isConfigured: () => true,
      search: jest.fn().mockResolvedValue([
        {
          id: 'ik-101',
          title: 'Municipal Corporation v Builder',
          citation: '(2020) 2 SCC 1',
          court: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/101/',
          summary: 'A dispute about municipal building permission and zoning.',
          judges: [],
          decisionDate: new Date('2020-01-01'),
          fullText:
            'The municipal authority considered building permission, zoning restrictions, and development control regulations.',
          treatmentHint: null,
        },
      ]),
      fetchDocFragment: jest
        .fn()
        .mockResolvedValue('Building permission depends on zoning and municipal regulations.'),
    };
    const service = new IkEvidenceIngestService(
      connector as never,
      packService,
      queryBuilder,
    );

    const result = await service.retrieveAndIngest({
      query: 'anticipatory bail witness intimidation flight risk',
      legalIssues: ['whether anticipatory bail should be denied for witness intimidation'],
      propositionPhrases: ['accused poses a flight risk'],
    });

    expect(result.authorities).toEqual([]);
    expect(result.packDelta).toEqual([]);
    expect(result.searchStatus).toBe('no_hits');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'searched',
          hitCount: 1,
          rejectedCount: 1,
          rejectionReasons: expect.any(Object),
        }),
      ]),
    );
    expect(
      Object.values(result.diagnostics[0].rejectionReasons).reduce(
        (sum, count) => sum + count,
        0,
      ),
    ).toBe(1);
  });

  it('runs one bounded unsupported-claim repair pass and returns only new admissions', async () => {
    const connector = {
      isConfigured: () => true,
      search: jest.fn().mockResolvedValue([
        {
          id: 'ik-201',
          title: 'Existing Worker v Employer',
          citation: '(2021) 1 SCC 1',
          court: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/201/',
          summary: 'Termination without inquiry under section 25F.',
          judges: [],
          decisionDate: new Date('2021-01-01'),
          fullText:
            'Termination without domestic inquiry and section 25F of the Industrial Disputes Act were considered.',
          treatmentHint: 'followed',
        },
        {
          id: 'ik-202',
          title: 'New Worker v Employer',
          citation: '(2023) 2 SCC 2',
          court: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/202/',
          summary: 'Termination without domestic inquiry violates natural justice.',
          judges: [],
          decisionDate: new Date('2023-01-01'),
          fullText:
            'The Court considered whether termination without domestic inquiry violates natural justice under section 25F of the Industrial Disputes Act.',
          treatmentHint: 'followed',
        },
      ]),
      fetchDocFragment: jest.fn().mockResolvedValue(
        'Termination without domestic inquiry violates natural justice under section 25F.',
      ),
    };
    const service = new IkEvidenceIngestService(
      connector as never,
      packService,
      queryBuilder,
    );

    const result = await service.retrieveUnsupportedClaimRepairPass({
      repairPass: 1,
      query: 'wrongful termination appeal',
      jurisdiction: 'Delhi',
      targets: [
        {
          issueId: 'termination',
          claimId: 'claim-1',
          claimText:
            'Termination without domestic inquiry violates section 25F of the Industrial Disputes Act',
        },
        {
          issueId: 'natural-justice',
          claimId: 'claim-2',
          claimText: 'Denial of a hearing violates principles of natural justice',
        },
        {
          issueId: 'remedy',
          claimId: 'claim-3',
          claimText: 'Reinstatement may follow an illegal termination',
        },
        {
          issueId: 'ignored',
          claimId: 'claim-4',
          claimText: 'This fourth target must not enter the bounded pass',
        },
      ],
      proceduralPosture: 'appeal',
      existingAuthorities: [
        {
          id: 'ik-201',
          title: 'Existing Worker v Employer',
          citation: '(2021) 1 SCC 1',
          sourceName: 'Supreme Court of India',
          summary: 'Already present',
          sourceTier: 'case_law',
        },
      ],
    });

    expect(result.repairPass).toBe(1);
    expect(result.attemptedClaimIds).toEqual(['claim-1', 'claim-2', 'claim-3']);
    expect(result.queries.join('\n')).not.toContain('fourth target');
    expect(connector.search).toHaveBeenCalled();
    expect(connector.search.mock.calls.length).toBeLessThanOrEqual(6);
    expect(
      connector.search.mock.calls.every(
        ([call]: [{ limit: number }]) => call.limit === 2,
      ),
    ).toBe(true);
    expect(result.authorities.map((authority) => authority.id)).toEqual(['ik-202']);
    expect(result.authorities[0]).toEqual(
      expect.objectContaining({
        relevanceGate: 'admitted',
        relevanceScore: expect.any(Number),
        relevanceReason: expect.stringContaining('admitted'),
      }),
    );
    expect(result.packDelta.map((evidence) => evidence.authorityId)).toEqual(['ik-202']);
  });

  it('rejects attempts to invoke a second unsupported-claim repair pass', async () => {
    const connector = { isConfigured: () => true, search: jest.fn() };
    const service = new IkEvidenceIngestService(
      connector as never,
      packService,
      queryBuilder,
    );

    await expect(
      service.retrieveUnsupportedClaimRepairPass({
        repairPass: 2,
        targets: [{ issueId: 'i', claimId: 'c', claimText: 'bail flight risk' }],
      } as never),
    ).rejects.toThrow('exactly one repair pass');
    expect(connector.search).not.toHaveBeenCalled();
  });
});
