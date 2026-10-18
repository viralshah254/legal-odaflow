import { truncateAtSentence } from './text-truncate';
import {
  isAdvocatePracticeNote,
  normalizeSectionText,
  resolvePracticeNote,
  truncateSuggestTitle,
} from './india-section-finder/section-finder-text';
import {
  findScheduleTableBoundary,
  isPrimarilyTableOrScheduleText,
  stripEmbeddedSchedulesAndTables,
} from './section-text-sanitize';

describe('truncateAtSentence', () => {
  it('returns short text unchanged', () => {
    expect(truncateAtSentence('Hello world.', 100)).toBe('Hello world.');
  });

  it('breaks at sentence boundary before char limit', () => {
    const text =
      'First sentence here. Second sentence with seal or stamp or signature continues.';
    const result = truncateAtSentence(text, 25);
    expect(result).toBe('First sentence here.');
  });

  it('breaks at word boundary when no sentence break', () => {
    const text = 'word '.repeat(100).trim();
    const result = truncateAtSentence(text, 40);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(41);
  });
});

describe('section-finder-text', () => {
  const sectionText =
    '82. Presumption as to document admissible in England without proof of seal or stamp or signature.';

  it('rejects bare-act dump as practice note', () => {
    const truncated = sectionText.slice(0, 80);
    expect(isAdvocatePracticeNote(truncated, sectionText)).toBe(false);
    expect(resolvePracticeNote(truncated, sectionText)).toBeUndefined();
  });

  it('accepts distinct advocate guidance', () => {
    const note = 'Certificate requirements differ for foreign public documents; verify apostille chain.';
    expect(isAdvocatePracticeNote(note, sectionText)).toBe(true);
    expect(resolvePracticeNote(note, sectionText)).toBe(note);
  });

  it('strips court-fees schedule tables from section text', () => {
    const dump =
      '7. Article 15 rep. by Act 11 of 1923, sec. 3 and Sch. II.\n\n' +
      'THE COURT-FEES ACT,1870 28\n\n' +
      'Table of Rates of ad valorem Fees Leviable on the institution of suits\n' +
      'When the amount or value of the subject-matter exceeds\n' +
      'Proper fee\nRs. Rs. Rs. A. P.\n5 10 0 12 0';
    expect(normalizeSectionText(dump)).toBe(
      '7. Article 15 rep. by Act 11 of 1923, sec. 3 and Sch. II.',
    );
  });

  it('returns undefined for pure table content', () => {
    const table =
      'Table of Rates of ad valorem Fees\nProper fee\nRs. Rs. Rs. A. P.\n' +
      '5 10 0 12 0\n10 15 1 2 0\n15 20 1 8 0\n20 25 1 14 0';
    expect(normalizeSectionText(table)).toBeUndefined();
  });

  it('strips inline court-fees table bleed without leading newline', () => {
    const inline =
      '7. Article 15 rep. THE COURT-FEES ACT,1870 28 Table of Rates of ad valorem Fees Proper fee Rs. Rs. Rs. A. P.';
    expect(stripEmbeddedSchedulesAndTables(inline)).toBe('7. Article 15 rep.');
    expect(findScheduleTableBoundary(inline)).toBeLessThan(inline.length);
  });

  it('truncateSuggestTitle caps long titles', () => {
    const longTitle = 'A'.repeat(200);
    const capped = truncateSuggestTitle(longTitle, 120);
    expect(capped).toBeDefined();
    expect(capped!.length).toBeLessThanOrEqual(120);
    expect(capped!.endsWith('…')).toBe(true);
  });
});
