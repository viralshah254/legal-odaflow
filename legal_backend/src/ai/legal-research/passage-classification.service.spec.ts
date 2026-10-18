import { PassageClassificationService } from './passage-classification.service';

describe('PassageClassificationService', () => {
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

  it('classifies statutory authority independently of prose wording', () => {
    expect(service.classify('Every application shall be filed within thirty days.', 'statute'))
      .toMatchObject({ classification: 'STATUTORY_TEXT', confidence: 1 });
  });
});
