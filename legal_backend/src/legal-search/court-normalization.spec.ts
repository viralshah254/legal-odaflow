import { normalizeCourtMetadata } from './court-normalization';

describe('normalizeCourtMetadata Kenya', () => {
  it.each([
    ['KESC', 'Supreme Court of Kenya', 0],
    ['Court of Appeal at Nairobi (KECA)', 'Court of Appeal of Kenya', 1],
    ['High Court of Kenya at Mombasa', 'High Court of Kenya', 2],
    ['Environment and Land Court (KELC)', 'Environment and Land Court of Kenya', 2],
    [
      'Employment and Labour Relations Court (KEELRC)',
      'Employment and Labour Relations Court of Kenya',
      2,
    ],
    ["Chief Magistrate's Court (KEMC)", "Magistrates' Courts of Kenya", 3],
  ])('normalizes %s', (input, court, courtTierRank) => {
    expect(normalizeCourtMetadata(input)).toEqual({ court, courtTierRank });
  });

  it('does not classify the Supreme Court of Kenya as an Indian court', () => {
    expect(normalizeCourtMetadata('Supreme Court of Kenya').court).toBe(
      'Supreme Court of Kenya',
    );
  });
});
