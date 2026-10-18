import { parseKenyaActPdfText } from './kenya-act-pdf-text.parser';

describe('parseKenyaActPdfText', () => {
  const sourceUrl = 'https://new.kenyalaw.org/akn/ke/act/2020/1/eng@2020-04-09/source.pdf';

  it('splits explicit Section headings', () => {
    const text = `
Short title

Section 1 — Short title.
This Act may be cited as the Business Laws (Amendment) Act, 2020.

Section 2 — Amendment of section 3.
Section 3 of the principal Act is amended by deleting subsection (1).
`.trim();

    const { sections, complete } = parseKenyaActPdfText(text, sourceUrl);
    expect(complete).toBe(true);
    expect(sections).toHaveLength(2);
    expect(sections[0].section).toBe('1');
    expect(sections[0].fullText).toMatch(/Business Laws/);
    expect(sections[1].section).toBe('2');
    expect(sections[0].sourceName).toBe('Kenya Law (source.pdf)');
  });

  it('splits numbered amendment-style headings', () => {
    const text = `
1. This Act may be cited as the Appropriation Act, 2025.

2. The Treasury may issue out of the Consolidated Fund sums not exceeding…
`.trim();

    const { sections, complete } = parseKenyaActPdfText(text, sourceUrl);
    expect(complete).toBe(true);
    expect(sections.map((s) => s.section)).toEqual(['1', '2']);
  });

  it('falls back to a single full section when split fails but body is long', () => {
    const text = 'A '.repeat(150) + 'schedule of appropriations without clear section markers.';
    const { sections, complete } = parseKenyaActPdfText(text, sourceUrl);
    expect(complete).toBe(false);
    expect(sections).toHaveLength(1);
    expect(sections[0].section).toBe('full');
    expect(sections[0].fullText.length).toBeGreaterThan(200);
  });

  it('returns empty for tiny text', () => {
    const { sections, complete } = parseKenyaActPdfText('x', sourceUrl);
    expect(sections).toEqual([]);
    expect(complete).toBe(false);
  });
});
