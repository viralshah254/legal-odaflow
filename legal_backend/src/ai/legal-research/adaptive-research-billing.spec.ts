import { automaticResearchEvidenceCredits } from './adaptive-research-billing';

describe('automatic adaptive evidence billing', () => {
  it('charges zero when the adaptive pass adds no evidence', () => {
    expect(
      automaticResearchEvidenceCredits({ casesAdded: 0, sectionsAdded: 0 }),
    ).toBe(0);
  });

  it.each([
    { casesAdded: 2, sectionsAdded: 0 },
    { casesAdded: 0, sectionsAdded: 2 },
    { casesAdded: 3, sectionsAdded: 1 },
  ])('charges one combined add-on for $casesAdded cases and $sectionsAdded sections', (input) => {
    expect(automaticResearchEvidenceCredits(input)).toBeGreaterThan(0);
  });
});
