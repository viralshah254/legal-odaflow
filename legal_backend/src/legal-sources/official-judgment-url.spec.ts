import {
  extractIndiaKanoonDocId,
  inferJudgmentProvider,
  isOfficialIndianJudgmentUrl,
} from './official-judgment-url';

describe('official-judgment-url', () => {
  it('recognizes Indian Kanoon and e-SCR judgment URLs', () => {
    expect(isOfficialIndianJudgmentUrl('https://indiankanoon.org/doc/123456/')).toBe(true);
    expect(isOfficialIndianJudgmentUrl('https://scr.sci.gov.in/scrsearch/?path=2024_3_627')).toBe(
      true,
    );
    expect(isOfficialIndianJudgmentUrl('https://example.com/blog/post')).toBe(false);
  });

  it('infers provider and India Kanoon doc id', () => {
    expect(inferJudgmentProvider('https://indiankanoon.org/doc/42/')).toBe('india-kanoon');
    expect(extractIndiaKanoonDocId('https://indiankanoon.org/doc/42/')).toBe('ik-42');
  });
});
