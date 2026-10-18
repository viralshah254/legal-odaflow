import { SectionFinderService } from './section-finder.service';
import type { SectionFinderAiFallbackService } from '@/legal-search/section-finder-ai-fallback.service';

describe('SectionFinderService intent→verify', () => {
  function buildService(opts: {
    propose: jest.Mock;
    resolveHit?: object | null;
  }) {
    const aiFallback = {
      proposeCandidatesFromIntent: opts.propose,
      suggest: jest.fn().mockResolvedValue({ suggestions: [], modelName: 'test' }),
    } as unknown as SectionFinderAiFallbackService;

    const curatedHit = opts.resolveHit ?? {
      id: 'bnss-483',
      legacyActId: 'crpc',
      legacyActShort: 'CrPC',
      legacyActFull: 'CrPC',
      legacySection: '439',
      legacyTitle: 'Special powers of High Court or Court of Session regarding bail',
      newActId: 'bnss',
      newActShort: 'BNSS',
      newActFull: 'BNSS',
      newSection: '483',
      newTitle: 'Special powers of High Court or Court of Session regarding bail',
      changeType: 'renumbered',
      changeSummary: 'CrPC 439 → BNSS 483',
      punishment: '',
      isBailable: true,
      isCognizable: false,
      isCompoundable: false,
      trialCourt: 'sessions',
      trialCourtLabel: 'Sessions',
      bailPosture: 'Discretionary',
      sourceRef: 'schedule1',
      transitionDate: '2024-07-01',
      matchSource: 'curated',
      sectionText: 'Verified corpus text for BNSS 483',
    };

    const service = new SectionFinderService(
      {
        statuteSectionProfile: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as never,
      {
        lookupExactSection: jest.fn().mockResolvedValue({ found: false }),
        lookupSection: jest.fn().mockResolvedValue([]),
        buildSectionId: jest.fn(),
      } as never,
      {
        isActInManifest: jest.fn().mockReturnValue(false),
        resolveSectionOnDemand: jest.fn(),
      } as never,
      {
        searchStatuteSectionsPg: jest.fn().mockResolvedValue([]),
      } as never,
      {
        findProfile: jest.fn().mockResolvedValue(null),
        findProfileByNewAct: jest.fn().mockResolvedValue(null),
        findProfileByLegacyKey: jest.fn().mockResolvedValue(null),
        profileToEntry: jest.fn(),
        mergeProfileWithAuthority: jest.fn(),
      } as never,
      {
        recordSearch: jest.fn(),
        getPopular: jest.fn(),
      } as never,
      {
        localizeEntry: jest.fn(async (entry: unknown) => entry),
      } as never,
      {
        recordUnmatched: jest.fn(),
      } as never,
      aiFallback,
      undefined,
    );

    // Force corpus resolve path via private method spy when propose returns candidates.
    jest
      .spyOn(
        service as unknown as {
          resolveCandidateInCorpus: (
            actId: string,
            section: string,
          ) => Promise<object | null>;
        },
        'resolveCandidateInCorpus',
      )
      .mockImplementation(async (actId: string, section: string) => {
        if (String(actId).toLowerCase() === 'bnss' && String(section) === '483') {
          return curatedHit;
        }
        return null;
      });

    return { service, aiFallback, curatedHit };
  }

  it('proposes AI candidates for NL queries and only returns corpus-verified matches', async () => {
    const propose = jest.fn().mockResolvedValue({
      modelName: 'gpt-fast',
      suggestions: [
        {
          actId: 'bnss',
          actShort: 'BNSS',
          section: '483',
          title: 'Sessions/HC bail',
          confidence: 'high',
          rationale: 'fact pattern',
          source: 'ai_suggest',
          verificationState: 'ai_suggested',
        },
        {
          actId: 'bns',
          actShort: 'BNS',
          section: '9999',
          title: 'Invented',
          confidence: 'low',
          rationale: 'guess',
          source: 'ai_suggest',
          verificationState: 'ai_suggested',
        },
      ],
    });

    const { service } = buildService({ propose });
    const result = await service.find({
      q: 'what section covers special bail powers of sessions court',
      countryCode: 'IN',
    });

    expect(propose).toHaveBeenCalled();
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].newSection).toBe('483');
    expect(result.matches[0].matchSource).not.toBe('ai');
    expect(result.matches[0].sectionText).toContain('Verified corpus');
    expect(result.aiSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: '9999',
          verificationState: 'ai_suggested',
        }),
      ]),
    );
  });

  it('skips intent proposal for bare section refs', async () => {
    const propose = jest.fn();
    const { service } = buildService({ propose });

    // Bare path still needs enough stubs; expect BadRequest or empty after cascade.
    await service
      .find({ q: 'BNSS 483', countryCode: 'IN' })
      .catch(() => undefined);

    expect(propose).not.toHaveBeenCalled();
  });
});
