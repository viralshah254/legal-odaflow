import { extractNamedStatuteQueries } from './named-statute-extract';

const BNSS_BAIL_BRIEF = `
Case Type: Criminal Bail Matter
Law: Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)
Provision: Section 480 BNSS — Bail in non-bailable offence
Court: Sessions Court, Ahmedabad
Offences: Sections 115(2), 352 and 351(2) of the Bharatiya Nyaya Sanhita, 2023
Issue: Whether the accused should be granted regular bail
`;

describe('extractNamedStatuteQueries', () => {
  it('pins BNSS 480 and listed BNS offences from a structured brief', () => {
    const queries = extractNamedStatuteQueries(BNSS_BAIL_BRIEF);
    expect(queries.some((q) => /480/i.test(q) && /BNSS/i.test(q))).toBe(true);
    expect(queries.some((q) => /115/.test(q) && /BNS/i.test(q))).toBe(true);
    expect(queries.some((q) => /352/.test(q) && /BNS/i.test(q))).toBe(true);
    expect(queries.some((q) => /351/.test(q) && /BNS/i.test(q))).toBe(true);
  });

  it('pins Oxford-comma BNS offences and BNSS 480 from a natural-language bail query', () => {
    const queries = extractNamedStatuteQueries(
      'Whether Rahul Mehta, accused of offences under Sections 115(2), 352, and 351(2) of the Bharatiya Nyaya Sanhita, 2023, should be granted regular bail under Section 480 of the Bharatiya Nagarik Suraksha Sanhita, 2023, given that investigation is pending and charge-sheet has not been filed?',
    );
    expect(queries.some((q) => /480/i.test(q) && /BNSS/i.test(q))).toBe(true);
    expect(queries.some((q) => /115/.test(q) && /BNS/i.test(q))).toBe(true);
    expect(queries.some((q) => /352/.test(q) && /BNS/i.test(q))).toBe(true);
    expect(queries.some((q) => /351/.test(q) && /BNS/i.test(q))).toBe(true);
  });

  it('pins a named civil provision (TPA / NI Act)', () => {
    expect(extractNamedStatuteQueries('Whether Section 106 of the Transfer of Property Act applies')).toEqual(
      expect.arrayContaining([expect.stringMatching(/106.*Transfer of Property/i)]),
    );
    expect(extractNamedStatuteQueries('Dishonour under section 138 NI Act')).toEqual(
      expect.arrayContaining([expect.stringMatching(/138.*NI/i)]),
    );
  });
});
