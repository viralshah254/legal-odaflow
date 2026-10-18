import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';

describe('draft citation hallucination prevention', () => {
  it('strips fabricated maintenance misuse of Badri Prasad', () => {
    const text =
      'The Supreme Court in Badri Prasad v. Director of Consolidation, AIR 1978 SC 1557 held maintenance must be paid.';
    const authorities = [
      {
        id: '1',
        title: 'Rajnesh v. Neha',
        citation: '(2021) 2 SCC 324',
        sourceName: 'SCC',
        summary: 'Maintenance case',
      },
    ];

    const result = stripUnverifiedCitations(text, authorities);
    expect(result.text).not.toContain('AIR 1978 SC 1557');
    expect(result.stripped.length).toBeGreaterThan(0);
  });

  it('preserves citation when authority matches retrieved list', () => {
    const text = 'As held in Rajnesh v. Neha (2021) 2 SCC 324, financial disclosure is mandatory.';
    const authorities = [
      {
        id: '1',
        title: 'Rajnesh v. Neha',
        citation: '(2021) 2 SCC 324',
        sourceName: 'SCC',
        summary: 'Maintenance',
      },
    ];

    const result = stripUnverifiedCitations(text, authorities);
    expect(result.text).toContain('(2021) 2 SCC 324');
    expect(result.stripped).toHaveLength(0);
  });
});
