import { IndiaDraftGroundingService } from './india-draft-grounding.service';

describe('IndiaDraftGroundingService', () => {
  it('pins BNSS §173 for FIR kind but does not hard-pin BNS §78 without governing sections', async () => {
    const bareActLookup = {
      lookupExactSection: jest.fn(async (actId: string, section: string) => ({
        found: true,
        actId,
        section,
        authority: {
          id: `statute-in-${actId}-s${section}`,
          title: `${actId.toUpperCase()} Section ${section}`,
          citation: `${actId.toUpperCase()} s.${section}`,
          sourceName: 'Bare Act Corpus',
          summary: `${actId} ${section} summary`,
          fullText: `${actId} ${section} full text`,
          sourceUrl: null,
          countryCode: 'IN',
          jurisdiction: null,
          authorityType: 'STATUTE_SECTION',
          score: 1,
        },
      })),
    };
    const service = new IndiaDraftGroundingService(
      bareActLookup as never,
      { buildContext: jest.fn() } as never,
    );

    const authorities = await service.buildGroundingAuthorities('india_fir_complaint');

    expect(authorities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          citation: 'BNSS s.173',
          sourceTier: 'primary',
        }),
      ]),
    );
    expect(authorities.some((a) => a.citation === 'BNS s.78')).toBe(false);
  });

  it('includes BNS §78 when provided as a governing section from the offence router', async () => {
    const bareActLookup = {
      lookupExactSection: jest.fn(async (actId: string, section: string) => ({
        found: true,
        actId,
        section,
        authority: {
          id: `statute-in-${actId}-s${section}`,
          title: `${actId.toUpperCase()} Section ${section}`,
          citation: `${actId.toUpperCase()} s.${section}`,
          sourceName: 'Bare Act Corpus',
          summary: `${actId} ${section} summary`,
          fullText: `${actId} ${section} full text`,
          sourceUrl: null,
          countryCode: 'IN',
          jurisdiction: null,
          authorityType: 'STATUTE_SECTION',
          score: 1,
        },
      })),
    };
    const service = new IndiaDraftGroundingService(
      bareActLookup as never,
      { buildContext: jest.fn() } as never,
    );

    const authorities = await service.buildGroundingAuthorities('india_fir_complaint', [
      {
        actId: 'bns',
        section: '78',
        label: 'BNS §78 (stalking)',
        predecessor: { actId: 'ipc', section: '354D' },
      },
    ]);

    expect(authorities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ citation: 'BNSS s.173' }),
        expect.objectContaining({ citation: 'BNS s.78' }),
      ]),
    );
  });
});
