import { isHeadingOnlyStatuteAuthority } from './retrieval-citation-guard';

describe('legal retrieval citation guardrails', () => {
  const base = {
    id: 'statute-in-example-s3',
    title: 'Example Act, 2024 — Section 3 — Duty to refund',
    citation: 'Example Act s.3',
    sourceName: 'India Code',
    summary: null,
    sourceTier: 'primary' as const,
    authorityType: 'STATUTE_SECTION',
    section: '3',
    heading: 'Duty to refund',
  };

  it('rejects heading-only statute sections', () => {
    expect(
      isHeadingOnlyStatuteAuthority({ ...base, fullText: '3. Duty to refund' }),
    ).toBe(true);
  });

  it('does not reject legitimately terse operative sections', () => {
    expect(
      isHeadingOnlyStatuteAuthority({
        ...base,
        fullText: '3. Duty to refund.—The provider shall refund the amount.',
      }),
    ).toBe(false);
  });
});
