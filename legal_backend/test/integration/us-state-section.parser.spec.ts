import {
  parseUsStateSectionHtml,
  parseUsStateSectionLinks,
  stripHtml,
} from '@/legal-sources/parsers/us-state-section.parser';

describe('us-state-section.parser', () => {
  it('stripHtml removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('parseUsStateSectionHtml extracts section body', () => {
    const html =
      '<main><p>§ 187. Murder is the unlawful killing of a human being with malice aforethought.</p></main>';
    const text = parseUsStateSectionHtml(html, '187');
    expect(text).toBeDefined();
    expect(text!.toLowerCase()).toContain('murder');
  });

  it('parseUsStateSectionLinks finds section hrefs', () => {
    const html =
      '<a href="/ca/penal-code/section-187/">Section 187 Murder</a>' +
      '<a href="/ca/penal-code/section-211/">Section 211 Robbery</a>';
    const links = parseUsStateSectionLinks(html, 'https://codes.findlaw.com/ca/penal-code/');
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links.some((l) => l.section === '187')).toBe(true);
  });
});
