import { isCompleteEscrCaseHit, type EscrSearchHit } from './escr.connector';

describe('e-SCR citation metadata gate', () => {
  const complete: EscrSearchHit = {
    id: 'escr-2024-1-10',
    title: 'Rao v. National Bank Ltd.',
    citation: '(2024) 1 SCR 10',
    neutralCitation: '2024 INSC 10',
    court: 'Supreme Court of India',
    sourceUrl: 'https://scr.sci.gov.in/scrsearch/?path=2024_1_10',
    decisionDate: new Date('2024-03-15'),
    judges: [],
    summary: 'Electronic payment dispute.',
    metadataPath: '2024_1_10',
  };

  it('admits a complete case hit', () => {
    expect(isCompleteEscrCaseHit(complete)).toBe(true);
  });

  it.each([
    ['title', { title: 'Rao' }],
    ['court', { court: null }],
    ['date', { decisionDate: null }],
    ['citation', { citation: null }],
    ['source URL', { sourceUrl: '' }],
  ])('rejects a hit missing %s metadata', (_label, change) => {
    expect(isCompleteEscrCaseHit({ ...complete, ...change })).toBe(false);
  });
});
