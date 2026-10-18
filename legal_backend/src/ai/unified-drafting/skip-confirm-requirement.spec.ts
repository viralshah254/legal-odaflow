import { resolveSkipConfirmRequirement } from './skip-confirm-requirement';

describe('resolveSkipConfirmRequirement', () => {
  const confirmed = {
    parties: [{ role: 'Petitioner', name: 'A' }],
    metadata: { status: 'confirmed' },
  };

  it('does not skip confirm on filing-grade without a confirmed Case Record', () => {
    expect(resolveSkipConfirmRequirement(true, undefined)).toBe(false);
    expect(resolveSkipConfirmRequirement(true, { parties: [] })).toBe(false);
  });

  it('skips confirm only when the UI sent a confirmed record', () => {
    expect(resolveSkipConfirmRequirement(true, confirmed)).toBe(true);
  });

  it('skips confirm for non-filing-grade kinds', () => {
    expect(resolveSkipConfirmRequirement(false, undefined)).toBe(true);
  });
});
