import { ResearchSectionFinderGroundingService } from './research-section-finder-grounding.service';

describe('ResearchSectionFinderGroundingService', () => {
  const sectionFinder = { find: jest.fn() } as any;
  const keSectionFinder = { find: jest.fn() } as any;
  const service = new ResearchSectionFinderGroundingService(sectionFinder, keSectionFinder);

  it('does not inject BSA/BNSS topic hints into an employment research query', () => {
    expect(
      service.extractQueries(
        'Employee seeks wrongful termination remedies. Preserve workplace harassment evidence.',
        'EMPLOYMENT',
        'IN',
      ),
    ).toEqual([]);
  });

  it('extracts listed BNS offences and BNSS 480 from a structured bail brief', () => {
    const queries = service.extractQueries(
      `Provision: Section 480 BNSS
Offences: Sections 115(2), 352 and 351(2) of the Bharatiya Nyaya Sanhita, 2023`,
      'CRIMINAL',
      'IN',
    );
    expect(queries.some((q) => /480/i.test(q) && /BNSS/i.test(q))).toBe(true);
    expect(queries.some((q) => /115/.test(q))).toBe(true);
    expect(queries.some((q) => /352/.test(q))).toBe(true);
    expect(queries.some((q) => /351/.test(q))).toBe(true);
  });

  it('does not dump topic-hint sections when the query already names statutes', () => {
    const queries = service.extractQueries(
      'Whether regular bail should be granted under Section 480 BNSS while investigation is pending',
      'CRIMINAL',
      'IN',
    );
    expect(queries.some((q) => /480/i.test(q) && /BNSS/i.test(q))).toBe(true);
    expect(queries.some((q) => /483/.test(q))).toBe(false);
  });

  describe('jurisdictions without a Section Finder corpus', () => {
    it('grounds a US query against the statute registry instead of returning nothing', async () => {
      const context = await service.buildContext(
        'Can a plaintiff sue under 42 U.S.C. § 1983 for an unlawful arrest?',
        'CONSTITUTIONAL',
        'US',
      );

      expect(context.promptBlock).toContain('STATUTE REGISTRY VERIFIED (US');
      expect(context.promptBlock).toMatch(/section wording was not retrieved/i);
      // Never reaches the India/Kenya Section Finder services.
      expect(sectionFinder.find).not.toHaveBeenCalled();
      expect(keSectionFinder.find).not.toHaveBeenCalled();
    });

    it('tells the model not to invent statutes when the registry has no match', async () => {
      const context = await service.buildContext(
        'What are the general principles of equitable estoppel?',
        undefined,
        'GB',
      );

      expect(context.authorities).toEqual([]);
      expect(context.promptBlock).toMatch(/do not invent GB act names/i);
    });
  });

  it('retains criminal section hints for a criminal research query', () => {
    expect(service.extractQueries('anticipatory bail after FIR', 'CRIMINAL', 'IN')).toEqual(
      expect.arrayContaining(['482 BNSS', '438 CrPC']),
    );
  });

  it('extracts Kenya employment hints for KE queries', () => {
    expect(
      service.extractQueries('Can an employer terminate without redundancy pay?', 'EMPLOYMENT', 'KE'),
    ).toEqual(expect.arrayContaining(['Employment Act 2007 s.41']));
  });

  it('routes Kenya buildContext lookups through the KE section finder', async () => {
    keSectionFinder.find.mockResolvedValue({
      matches: [
        {
          id: 'statute-ke-employment-act-2007-s41',
          legacyActId: 'other',
          legacyActShort: 'Employment Act',
          legacyActFull: 'Employment Act, 2007',
          legacySection: '41',
          legacyTitle: 'Termination notice',
          newActId: 'unchanged',
          newActShort: 'Employment Act',
          newActFull: 'Employment Act, 2007',
          newSection: '',
          newTitle: '',
          changeType: 'unchanged',
          changeSummary: 'Summary',
          punishment: '',
          isBailable: false,
          isCognizable: false,
          isCompoundable: false,
          trialCourt: 'special_court',
          trialCourtLabel: 'ELRC',
          bailPosture: '',
          sourceRef: 'https://new.kenyalaw.org/',
          transitionDate: '2026-08-01',
        },
      ],
    });

    const context = await service.buildContext(
      'Employment Act 2007 termination notice',
      'EMPLOYMENT',
      'KE',
    );

    expect(keSectionFinder.find).toHaveBeenCalled();
    expect(context.promptBlock).toContain('Kenya Law');
    expect(context.authorities[0].sourceName).toBe('Kenya Section Finder');
  });

  it('never injects AI-only / unverified section text into the prompt block', async () => {
    sectionFinder.find.mockResolvedValue({
      matches: [
        {
          id: 'AI-FAKE-1',
          legacyActId: 'other',
          legacyActShort: 'Fake',
          legacyActFull: 'Fake',
          legacySection: '1',
          legacyTitle: 'Invented',
          newActId: 'unchanged',
          newActShort: 'Fake',
          newActFull: 'Fake',
          newSection: '1',
          newTitle: 'Invented',
          changeType: 'unchanged',
          changeSummary: 'AI invented summary',
          punishment: '',
          isBailable: false,
          isCognizable: false,
          isCompoundable: false,
          trialCourt: 'sessions',
          trialCourtLabel: 'Sessions',
          bailPosture: '',
          sectionText: 'UNVERIFIED AI SECTION TEXT MUST NOT APPEAR',
          sourceRef: 'AI-generated',
          transitionDate: '2024-07-01',
          matchSource: 'ai',
          verificationState: 'ai_suggested',
        },
      ],
    });

    const context = await service.buildContext('482 BNSS anticipatory bail', 'CRIMINAL', 'IN');
    expect(context.matches).toHaveLength(0);
    expect(context.promptBlock).not.toContain('UNVERIFIED AI SECTION TEXT');
    expect(context.authorities).toHaveLength(0);
  });
});
