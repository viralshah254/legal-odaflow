import { normalizeCountry } from './draft-training-pipeline.service';

/**
 * Every country lookup in research and drafting — source preference, official
 * case sources, section finder, learned prompt preferences — keys on a bare
 * uppercase code. This is the single funnel free-text jurisdictions pass through
 * before those lookups, so a miss here means a jurisdiction silently gets
 * another country's rules.
 */
describe('normalizeCountry', () => {
  it('passes a bare code through unchanged', () => {
    expect(normalizeCountry('IN')).toBe('IN');
    expect(normalizeCountry('GB')).toBe('GB');
  });

  it('uppercases a lowercase code', () => {
    expect(normalizeCountry('in')).toBe('IN');
    expect(normalizeCountry('ke')).toBe('KE');
  });

  it('strips a subdivision so a state does not read as an unknown country', () => {
    expect(normalizeCountry('IN-DL')).toBe('IN');
    expect(normalizeCountry('us_ny')).toBe('US');
    expect(normalizeCountry('gb-eng')).toBe('GB');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCountry('  IN  ')).toBe('IN');
  });

  it('returns empty for a missing jurisdiction so the caller applies its own default', () => {
    expect(normalizeCountry(undefined)).toBe('');
    expect(normalizeCountry(null)).toBe('');
    expect(normalizeCountry('')).toBe('');
    expect(normalizeCountry('   ')).toBe('');
  });

  it('does not invent a code for a country name it cannot resolve', () => {
    // Callers must fall through to the jurisdiction-agnostic path here rather
    // than have an unrecognised value quietly mapped onto a supported country.
    expect(normalizeCountry('India')).toBe('INDIA');
    expect(normalizeCountry('Kenya')).toBe('KENYA');
  });
});
