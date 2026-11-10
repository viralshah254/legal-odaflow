import { PassageClassificationService, markAttributedAuthorityPassages } from './passage-classification.service';

describe('PassageClassificationService', () => {
  it('keeps a quoted older decision separate across a page break and resumes the deciding court afterward', () => {
    const passages = markAttributedAuthorityPassages([
      { text: '[34] In that Case the Court of Appeal stated as follows: “We hereby set aside', page: 15, paragraph: '34' },
      { text: 'the award of US$108,000.”', page: 16 },
      { text: '[35] We conclude that the present appeal fails.', page: 17, paragraph: '35' },
    ]);
    expect(passages.filter(p => p.page === 16)).toEqual([expect.objectContaining({ classification: 'COMMENTARY', attribution: 'OTHER_AUTHORITY' })]);
    expect(passages.at(-1)?.attribution).toBeUndefined();
    expect(markAttributedAuthorityPassages(passages)).toEqual(passages);
  });

  it('does not turn a court’s own conclusion into another authority because it quotes a short legal term', () => {
    expect(markAttributedAuthorityPassages([{ text: 'We conclude that “separate but equal” has no place in public education.', page: 13 }])[0].attribution).toBeUndefined();
  });
  const service = new PassageClassificationService();

  it('identifies an express court holding', () => {
    expect(
      service.classify('We therefore hold that the appeal is maintainable.', 'case'),
    ).toMatchObject({ classification: 'HOLDING', deterministic: true });
  });

  it('does not mistake counsel submissions for holdings', () => {
    expect(
      service.classify('Learned counsel for the appellant submitted that the appeal is maintainable.', 'case'),
    ).toMatchObject({ classification: 'PARTY_SUBMISSION' });
  });

  it('leaves semantically plausible but unstructured case text unknown', () => {
    expect(
      service.classify('An appeal may be maintainable in these circumstances.', 'case'),
    ).toMatchObject({ classification: 'UNKNOWN', confidence: 0 });
  });

  it('recognizes explicit judicial derivation without promoting a party submission', () => {
    const reasoning = 'From the aforesaid dictionary meanings it becomes clear that resignation severs the relationship.';
    expect(service.classify(reasoning, 'case').classification).toBe('RATIO');
    expect(service.classify('The appellant submitted that ' + reasoning, 'case').classification).toBe('PARTY_SUBMISSION');
  });

  it('recognizes judicial reasoning and conclusions while keeping attributed arguments separate', () => {
    expect(service.classify('We must look instead to the effect of the challenged policy.', 'case').classification).toBe('RATIO');
    expect(service.classify('We conclude that the policy denies equal protection.', 'case').classification).toBe('HOLDING');
    expect(service.classify('The respondent argued that we must look instead to the policy.', 'case').classification).toBe('PARTY_SUBMISSION');
  });

  it('classifies statutory authority independently of prose wording', () => {
    expect(service.classify('Every application shall be filed within thirty days.', 'statute'))
      .toMatchObject({ classification: 'STATUTORY_TEXT', confidence: 1 });
  });
});
