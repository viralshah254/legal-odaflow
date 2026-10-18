import { KenyaDraftGroundingService } from './kenya-draft-grounding.service';

describe('KenyaDraftGroundingService', () => {
  const bareActLookup = {
    lookupExactSection: jest.fn().mockResolvedValue({
      found: true,
      authority: {
        id: 'statute-ke-employment-act-2007-s45',
        title: 'Employment Act s.45',
        citation: 'Employment Act 2007 s.45',
        sourceName: 'Kenya Law',
        summary: 'Unfair termination',
        fullText: 'No employer shall terminate unfairly.',
        sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2007/11',
        score: 1,
      },
    }),
  };
  const sectionFinderGrounding = {
    buildContext: jest.fn().mockResolvedValue({
      promptBlock: 'SECTION FINDER VERIFIED\n- Employment Act s.45',
      authorities: [],
      verifiedSectionLabels: ['Employment Act s.45'],
      queries: [],
      matches: [],
    }),
  };

  const service = new KenyaDraftGroundingService(
    bareActLookup as never,
    sectionFinderGrounding as never,
  );

  it('resolves employment claim sections', () => {
    const sections = service.resolvePrimarySections('kenya_memorandum_of_claim');
    expect(sections.some((s) => s.actId === 'employment-act-2007')).toBe(true);
  });

  it('builds grounding block with Kenya Law guidance', async () => {
    const block = await service.buildGroundingBlock(
      'kenya_memorandum_of_claim',
      'Employee was dismissed without hearing',
    );
    expect(block).toContain('AUTHORITATIVE KENYA SECTIONS');
    expect(block).toContain('Employment Act');
    expect(sectionFinderGrounding.buildContext).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      'KE',
    );
  });
});
