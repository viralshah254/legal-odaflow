import {
  isStructuredMatterBrief,
  shouldHardAbortOnMissingSimilarCases,
} from './research-task-context';

const BAIL_BRIEF = `Case Type: Criminal Bail Matter
Law: Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)
Provision: Section 480 BNSS
Court: Sessions Court, Ahmedabad
Issue: Whether the accused should be granted regular bail`;

const TPA_BRIEF = `Case Type: Civil tenancy
Law: Transfer of Property Act
Provision: Section 106
Court: Civil Judge, Ahmedabad
Issue: Whether the notice to quit is premature`;

describe('research task context', () => {
  it('treats labelled matter briefs as structured', () => {
    expect(isStructuredMatterBrief(BAIL_BRIEF)).toBe(true);
    expect(isStructuredMatterBrief(TPA_BRIEF)).toBe(true);
    expect(isStructuredMatterBrief('Explain the doctrine of separability')).toBe(false);
  });

  it('treats a natural-language named-statute bail question as a matter brief', () => {
    expect(
      isStructuredMatterBrief(
        'Whether Rahul Mehta, accused of offences under Sections 115(2), 352, and 351(2) of the Bharatiya Nyaya Sanhita, 2023, should be granted regular bail under Section 480 of the Bharatiya Nagarik Suraksha Sanhita, 2023, given that investigation is pending and charge-sheet has not been filed?',
      ),
    ).toBe(true);
    expect(
      isStructuredMatterBrief('What is the meaning and scope of section 11 of the Arbitration and Conciliation Act?'),
    ).toBe(false);
  });

  it('does not hard-abort a memo when statutes were retrieved or the task is not case-only', () => {
    expect(
      shouldHardAbortOnMissingSimilarCases({
        requireSimilarCases: true,
        similarCasesCount: 0,
        taskKind: 'CASE_LOOKUP',
        hasStatuteAuthorities: true,
        query: BAIL_BRIEF,
      }),
    ).toBe(false);
    expect(
      shouldHardAbortOnMissingSimilarCases({
        requireSimilarCases: true,
        similarCasesCount: 0,
        taskKind: 'MATTER_OPINION',
        hasStatuteAuthorities: false,
        query: BAIL_BRIEF,
      }),
    ).toBe(false);
    expect(
      shouldHardAbortOnMissingSimilarCases({
        requireSimilarCases: true,
        similarCasesCount: 0,
        taskKind: 'GENERAL_RESEARCH',
        hasStatuteAuthorities: false,
        query: 'What is the current position on arbitration clauses?',
      }),
    ).toBe(false);
  });

  it('hard-aborts only an explicit case lookup/compare with no statute pack', () => {
    expect(
      shouldHardAbortOnMissingSimilarCases({
        requireSimilarCases: true,
        similarCasesCount: 0,
        taskKind: 'CASE_LOOKUP',
        hasStatuteAuthorities: false,
        query: 'Find the case Kesavananda Bharati v State of Kerala',
      }),
    ).toBe(true);
    expect(
      shouldHardAbortOnMissingSimilarCases({
        requireSimilarCases: true,
        similarCasesCount: 0,
        taskKind: 'CASE_COMPARISON',
        hasStatuteAuthorities: false,
        query: 'Compare the facts and holdings in Vidya Drolia and Booz Allen',
      }),
    ).toBe(true);
  });
});
