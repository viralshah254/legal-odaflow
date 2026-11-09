import { researchExcerpt } from './research-excerpts';

describe('Authorized document excerpts', () => {
  it('retrieves relevant evidence late in a long document instead of always truncating the beginning', () => {
    const text = 'Unrelated cover material. '.repeat(1000) + 'The witness recanted the identification testimony in the signed statement.';
    const excerpt = researchExcerpt(text, 'witness identification testimony', 1600);
    expect(excerpt).toContain('witness recanted');
    expect(excerpt).toContain('Extracted text characters');
    expect(excerpt.length).toBeLessThanOrEqual(1600);
  });
  it('retains the final order when high-scoring earlier passages crowd out disposition', () => {
    const text = 'Arrest safeguards police necessity reasons. '.repeat(500) +
      'Paragraph 18. The appeal is allowed and provisional bail is made absolute.';
    const excerpt = researchExcerpt(text, 'arrest safeguards police necessity reasons and actual disposition', 6000);
    expect(excerpt).toContain('provisional bail is made absolute');
    expect(excerpt).toContain('Arrest safeguards');
    expect(excerpt.length).toBeLessThanOrEqual(6000);
  });
  it('preserves a short source without invented page metadata and handles multilingual queries', () => {
    expect(researchExcerpt('Short original source.', 'source', 100)).toBe('Short original source.');
    expect(researchExcerpt('विषय '.repeat(1000) + 'गवाह पहचान प्रमाण', 'गवाह पहचान', 500)).toContain('गवाह पहचान');
  });
  it('does not exceed an empty or tiny context budget', () => {
    expect(researchExcerpt('source text', 'source', 0)).toBe('');
    expect(researchExcerpt('source text', undefined, 4)).toBe('sour');
  });
});
