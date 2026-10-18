import {
  expandIndiaLegalAbbreviations,
  INDIA_LEGAL_ABBREVIATIONS,
  listIndiaAbbreviations,
  resolveIndiaAbbreviation,
} from './india-legal-abbreviations';

describe('india-legal-abbreviations', () => {
  const imageCourts = [
    'SC',
    'HC',
    'DJ',
    'CJ',
    'CJI',
    'ACJ',
    'ADJ',
    'MM',
    'JMFC',
    'JM',
    'CJM',
    'SDM',
    'CAT',
    'DRT',
    'DRAT',
    'NCLT',
    'NCLAT',
    'ITAT',
    'SAT',
    'TDSAT',
  ];

  const imageStatutes = ['CrPC', 'CPC', 'IPC'];

  it('includes all courts and tribunals from the India reference image', () => {
    const abbrs = new Set(INDIA_LEGAL_ABBREVIATIONS.map((row) => row.abbr));
    for (const token of [...imageCourts, ...imageStatutes]) {
      expect(abbrs.has(token)).toBe(true);
    }
  });

  it('resolves dotted statute forms', () => {
    expect(resolveIndiaAbbreviation('Cr.P.C.')?.relatedActId).toBe('crpc');
    expect(resolveIndiaAbbreviation('C.P.C.')?.relatedActId).toBe('cpc');
    expect(resolveIndiaAbbreviation('I.P.C.')?.relatedActId).toBe('ipc');
  });

  it('lists courts separately from tribunals', () => {
    const courts = listIndiaAbbreviations('court').map((row) => row.abbr);
    expect(courts).toEqual(expect.arrayContaining(['SC', 'HC', 'CJM']));
    const tribunals = listIndiaAbbreviations('tribunal').map((row) => row.abbr);
    expect(tribunals).toEqual(expect.arrayContaining(['NCLT', 'ITAT', 'NGT']));
  });

  it('expands standalone abbreviations in queries', () => {
    const { expandedQueries, matched } = expandIndiaLegalAbbreviations('SLP before SC');
    expect(matched.map((row) => row.abbr)).toEqual(expect.arrayContaining(['SLP', 'SC']));
    expect(expandedQueries).toEqual(
      expect.arrayContaining([expect.stringMatching(/Special Leave Petition/i)]),
    );
  });
});
