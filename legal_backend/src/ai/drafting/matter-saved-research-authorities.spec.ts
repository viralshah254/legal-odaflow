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
