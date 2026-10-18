import { parseSectionAuthorityId } from '@/legal-search/india-section-finder/section-finder.service';
import { SECTION_FINDER_INDEX } from '@/legal-search/india-section-finder/section-finder.index';

describe('parseSectionAuthorityId', () => {
  it('parses income-tax section 59 authority id', () => {
    expect(parseSectionAuthorityId('statute-in-income-tax-s59')).toEqual({
      actId: 'income-tax',
      section: '59',
    });
  });

  it('parses hyphenated act ids with alphanumeric sections', () => {
    expect(parseSectionAuthorityId('statute-in-income-tax-s80C')).toEqual({
      actId: 'income-tax',
      section: '80C',
    });
  });

  it('returns null for non-statute ids', () => {
    expect(parseSectionAuthorityId('case-law-foo')).toBeNull();
  });
});

describe('authorityId curated resolution', () => {
  it('maps parsed authority to curated INCOME-TAX-59 index entry', () => {
    const parsed = parseSectionAuthorityId('statute-in-income-tax-s59');
    expect(parsed).not.toBeNull();
    const key = `${parsed!.actId.toUpperCase()}-${parsed!.section}`;
    const entry = SECTION_FINDER_INDEX.get(key);
    expect(entry?.legacySection).toBe('59');
    expect(entry?.legacyTitle).toMatch(/Profits chargeable/i);
  });
});
