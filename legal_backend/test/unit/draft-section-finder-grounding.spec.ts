import { DraftSectionFinderGroundingService } from '@/ai/drafting/draft-section-finder-grounding.service';

describe('DraftSectionFinderGroundingService', () => {
  const mockMatch = {
    id: 'crpc-125-bnss-144',
    legacyActShort: 'CrPC',
    legacySection: '125',
    newActShort: 'BNSS',
    newSection: '144',
    newTitle: 'Order for maintenance of wives, children and parents',
    sectionText: 'Section 144 BNSS 2023 — maintenance allowance.',
    changeSummary: 'CrPC s.125 is now BNSS s.144',
    practiceNote: 'Magistrate may order monthly maintenance.',
    bailPosture: 'Non-cognizable, bailable',
    trialCourtLabel: 'Judicial Magistrate',
    legacyActId: 'crpc',
    legacyActFull: 'CrPC',
    legacyTitle: 'Maintenance',
    newActId: 'bnss',
    newActFull: 'BNSS',
    changeType: 'renumbered',
    punishment: '',
    isBailable: true,
    isCognizable: false,
    isCompoundable: false,
    trialCourt: 'magistrate_first_class',
    sourceRef: 'schedule1',
    matchSource: 'crosswalk',
  };

  let service: DraftSectionFinderGroundingService;

  beforeEach(() => {
    service = new DraftSectionFinderGroundingService({
      find: jest.fn().mockResolvedValue({ matches: [mockMatch], total: 1 }),
    } as never);
  });

  it('extracts maintenance queries from case details', () => {
    const queries = service.extractQueries(
      'india_maintenance_order_revision',
      '125 crpc maintenance interim order Ram vs Ria',
    );
    expect(queries).toEqual(expect.arrayContaining(['144 BNSS', '125 CrPC']));
  });

  it('builds prompt block with Section Finder crosswalk and text', async () => {
    const ctx = await service.buildContext(
      'india_maintenance_order_revision',
      '125 crpc maintenance',
    );
    expect(ctx.matches.length).toBeGreaterThan(0);
    expect(ctx.promptBlock).toContain('CrPC §125 → BNSS §144');
    expect(ctx.promptBlock).toContain('Section text');
    expect(ctx.verifiedSectionLabels[0]).toContain('BNSS §144');
  });

  it('suggests fix when BNS §125 used for maintenance', () => {
    const fixes = service.suggestCrosswalkFixes(
      'Maintenance under BNS §125 for wife',
      [mockMatch as never],
    );
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0].to).toContain('BNSS §144');
  });

  it('excludes AI-only matches from draft grounding prompt', async () => {
    service = new DraftSectionFinderGroundingService({
      find: jest.fn().mockResolvedValue({
        matches: [
          {
            ...mockMatch,
            id: 'AI-ONLY',
            matchSource: 'ai',
            verificationState: 'ai_suggested',
            sectionText: 'UNVERIFIED AI DRAFT TEXT',
          },
        ],
        total: 1,
      }),
    } as never);

    const ctx = await service.buildContext(
      'india_maintenance_order_revision',
      '125 crpc maintenance',
    );
    expect(ctx.matches).toHaveLength(0);
    expect(ctx.promptBlock).not.toContain('UNVERIFIED AI DRAFT TEXT');
  });
});
