import {
  authorityLevelForKenyaDocument,
  canSatisfyStatutoryAuthority,
} from './kenya-corpus.types';

describe('Kenya corpus authority separation', () => {
  it('never allows a bill to satisfy statutory authority', () => {
    const level = authorityLevelForKenyaDocument('BILL');
    expect(level).toBe('OFFICIAL_PROSPECTIVE');
    expect(canSatisfyStatutoryAuthority(level)).toBe(false);
  });

  it('treats regulator material as administrative rather than enacted law', () => {
    const level = authorityLevelForKenyaDocument('REGULATOR_MATERIAL');
    expect(level).toBe('OFFICIAL_ADMINISTRATIVE');
    expect(canSatisfyStatutoryAuthority(level)).toBe(false);
  });
});
