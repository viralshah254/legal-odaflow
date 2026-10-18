import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import { UNVERIFIED_AUTHORITY_DISCLAIMER } from '@/ai/drafting/legal-accuracy-protocol';

describe('stripUnverifiedCitations', () => {
  it('replaces fabricated AIR citation with unverified disclaimer', () => {
    const text = 'Reliance may be placed on Jagdish Lal v Kamla Devi AIR 1989 SC 1475.';
    const result = stripUnverifiedCitations(text, []);

    expect(result.text).toContain(UNVERIFIED_AUTHORITY_DISCLAIMER);
    expect(result.text).not.toContain('AIR 1989 SC 1475');
    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0].original).toBe('AIR 1989 SC 1475');
  });

  it('preserves citations backed by retrieved authorities', () => {
    const text = 'See AIR 2010 SC 1 for the proposition.';
    const result = stripUnverifiedCitations(text, [
      {
        id: 'case-1',
        title: 'Maintenance case',
        citation: 'AIR 2010 SC 1',
        sourceName: 'Indian Kanoon',
      },
    ]);

    expect(result.text).toContain('AIR 2010 SC 1');
    expect(result.stripped).toHaveLength(0);
  });
});
