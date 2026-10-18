import { parseSectionAuthorityId } from '@/legal-search/india-section-finder/section-finder.service';
import { SECTION_FINDER_INDEX } from '@/legal-search/india-section-finder/section-finder.index';
import { TAX_ACTS_SECTION_FINDER_DATA } from '@/legal-search/india-section-finder/tax-acts.in';
import { detectRepealStatus } from '@/legal-sources/parsers/india-act-text.parser';
import { truncateSuggestTitle } from '@/legal-search/india-section-finder/section-finder-text';

describe('parseSectionAuthorityId', () => {
  it('parses standard statute section IDs', () => {
    expect(parseSectionAuthorityId('statute-in-income-tax-s80C')).toEqual({
      actId: 'income-tax',
      section: '80C',
    });
    expect(parseSectionAuthorityId('statute-in-ipc-s420')).toEqual({
      actId: 'ipc',
      section: '420',
    });
  });

  it('returns null for non-statute IDs', () => {
    expect(parseSectionAuthorityId('case-in-foo')).toBeNull();
    expect(parseSectionAuthorityId('')).toBeNull();
  });
});

describe('Section Finder suggest data sources', () => {
  it('SECTION_FINDER_INDEX includes IPC 420 for prefix 42', () => {
    const matches = [...SECTION_FINDER_INDEX.values()].filter(
      (e) =>
        e.legacySection.startsWith('42') ||
        (e.legacyActShort.toLowerCase().includes('ipc') && e.legacySection.startsWith('42')),
    );
    expect(matches.some((e) => e.legacyActId === 'ipc' && e.legacySection === '420')).toBe(true);
  });

  it('tax curated entries contain keyword tax in titles or summaries', () => {
    const taxHits = TAX_ACTS_SECTION_FINDER_DATA.filter(
      (e) =>
        e.legacyTitle.toLowerCase().includes('tax') ||
        e.changeSummary.toLowerCase().includes('tax'),
    );
    expect(taxHits.length).toBeGreaterThan(0);
  });

  it('detectRepealStatus flags omitted sections', () => {
    const result = detectRepealStatus('[Omitted]');
    expect(result.isRepealed).toBe(true);
    expect(result.repealNotes).toBeTruthy();
  });

  it('truncateSuggestTitle removes schedule dumps and caps length', () => {
    const dump =
      'Table of Rates of ad valorem Fees Proper fee Rs. Rs. Rs. A. P. ' + 'x'.repeat(200);
    expect(truncateSuggestTitle(dump)).toBeUndefined();
    const normal = truncateSuggestTitle('Court Fees — jurisdiction of courts');
    expect(normal).toBeDefined();
    expect(normal!.length).toBeLessThanOrEqual(120);
  });
});
