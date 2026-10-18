import { curatedCaseLawTopicSearch } from './curated-case-law-corpus';

describe('curatedCaseLawTopicSearch', () => {
  it('returns the validated partnership-arbitration authorities for the benchmark query', () => {
    const results = curatedCaseLawTopicSearch(
      'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
    );

    expect(results.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'vh-patel-company-v-hirubhai-himabhai-patel-2000',
        'jagdish-chander-v-ramesh-chander-2007',
        'purushottam-v-anil-2018',
      ]),
    );
    expect(results.every((entry) => (entry.keyParagraphs?.length ?? 0) > 0)).toBe(true);
  });
});
