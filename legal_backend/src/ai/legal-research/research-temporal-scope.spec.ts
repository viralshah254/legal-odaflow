import { authorityWithinResearchDate } from './research-temporal-scope';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
const base: RetrievedAuthority = { id: 'case', title: 'Arnesh Kumar v State of Bihar', citation: '(2014) 8 SCC 273', sourceName: 'Court', sourceTier: 'case_law', summary: null };
describe('historical research scope', () => {
  it('keeps a judgment available on the requested date', () => expect(authorityWithinResearchDate({ ...base, decisionDate: '2014-07-02' }, '2014-07-02')).toBe(true));
  it('rejects later reporter authorities even with missing decision metadata', () => expect(authorityWithinResearchDate({ ...base, citation: '[2026] 2 S.C.R. 107' }, '2014-07-02')).toBe(false));
  it('rejects a later decision in the same year', () => expect(authorityWithinResearchDate({ ...base, decisionDate: '2014-08-01' }, '2014-07-02')).toBe(false));
  it('does not present replacement codes under legacy Section Finder IDs', () => expect(authorityWithinResearchDate({ ...base, id: 'section-finder-CRPC-437', citation: 'BNSS §480', title: 'Bail' }, '2014-07-02')).toBe(false));
  it('does not remove historical authority from current research', () => expect(authorityWithinResearchDate(base, '2026-11-09')).toBe(true));
});
