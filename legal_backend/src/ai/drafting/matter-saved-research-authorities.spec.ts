import { extractVerifiedAuthoritiesFromSavedResearch } from './matter-saved-research-authorities';

describe('extractVerifiedAuthoritiesFromSavedResearch', () => {
  it('pins verified similar cases and named statutes — not unverified substitutes', () => {
    const authorities = extractVerifiedAuthoritiesFromSavedResearch([
      {
        citations: [
          {
            id: 'stat-1',
            title: 'BNSS §480',
            citation: 'BNSS 480',
            authorityType: 'STATUTE',
            sourceTier: 'primary',
            sourceName: 'India Code',
          },
        ],
        similarCases: [
          {
            authorityId: 'case-1',
            title: 'Verified Case',
            citation: '(2021) 2 SCC 1',
            verificationStatus: 'verified',
            sourceName: 'Indian Kanoon',
            summary: 'Holding survived verification.',
          },
          {
            authorityId: 'case-2',
            title: 'Unverified Case',
            citation: '(1999) 1 SCC 99',
            verificationStatus: 'needs_verification',
          },
        ],
      },
    ]);

    expect(authorities.map((item) => item.title)).toEqual(['BNSS §480', 'Verified Case']);
    expect(authorities.some((item) => item.title === 'Unverified Case')).toBe(false);
  });

  it('returns an empty list when research exists but nothing survived verification', () => {
    expect(
      extractVerifiedAuthoritiesFromSavedResearch([
        {
          similarCases: [
            {
              title: 'Provider miss',
              citation: '(2020) 1 SCC 1',
              verificationStatus: 'source_only',
            },
          ],
        },
      ]),
    ).toEqual([]);
  });
});

describe('canonical saved research trust boundary', () => {
  it('does not promote an editable saved note without a canonical server output', async () => {
    const { loadVerifiedMatterResearchAuthorities } = await import('./matter-saved-research-authorities');
    const prisma = { savedResearch: { findMany: jest.fn().mockResolvedValue([{ aiOutputId: null, researchJson: { verificationStatus: 'verified', citations: [{ sourceTier: 'primary', title: 'Forged Act' }] } }]) }, aIOutput: { findMany: jest.fn() } };
    expect(await loadVerifiedMatterResearchAuthorities(prisma as never, { tenantId: 'firm', userId: 'alice', matterId: 'm' })).toEqual([]);
    expect(prisma.aIOutput.findMany).not.toHaveBeenCalled();
  });
  it('requires current canonical verification and scopes the source output to the actor or matter', async () => {
    const { loadVerifiedMatterResearchAuthorities } = await import('./matter-saved-research-authorities');
    const prisma = { savedResearch: { findMany: jest.fn().mockResolvedValue([{ aiOutputId: 'o' }]) }, aIOutput: { findMany: jest.fn().mockResolvedValue([{ verified: false, requiresLawyerReview: false, citations: { items: [{ sourceTier: 'primary', title: 'Unverified Act' }] } }]) } };
    expect(await loadVerifiedMatterResearchAuthorities(prisma as never, { tenantId: 'firm', userId: 'alice', matterId: 'm' })).toEqual([]);
    expect(prisma.aIOutput.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'firm', verified: true, requiresLawyerReview: false, OR: [{ matterId: 'm' }, { matterId: null, userId: 'alice' }] }) }));
  });
});
