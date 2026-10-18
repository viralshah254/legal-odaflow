import { validateCitationContract } from './citation-contract';

describe('citation contract', () => {
  it('accepts a complete case with both parties and a verified pinpoint', () => {
    const result = validateCitationContract({
      kind: 'case',
      title: 'Rao v. National Bank Ltd.',
      court: 'Supreme Court of India',
      judgmentDate: '15 March 2024',
      neutralCitation: '2024 INSC 210',
      pinpoint: 'paragraph 42',
      proposition: 'A bank must investigate a disputed electronic transfer.',
    });

    expect(result.passed).toBe(true);
    expect(result.missingReasons).toEqual([]);
  });

  it('rejects case metadata with no second party or full judgment date', () => {
    const result = validateCitationContract({
      kind: 'case',
      title: 'Rao',
      court: 'Supreme Court of India',
      judgmentDate: '2024',
      citation: '(2024) 1 SCC 10',
      proposition: 'A proposition.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'partyName', passed: false }),
        expect.objectContaining({ dimension: 'judgmentDate', passed: false }),
        expect.objectContaining({ dimension: 'pinpoint', passed: false }),
      ]),
    );
  });

  it('retains terse operative statutes but rejects heading-only stubs', () => {
    const common = {
      kind: 'statute' as const,
      actName: 'Example Act',
      actYear: 2024,
      section: '3',
      heading: 'Duty to refund',
      proposition: 'The provider must refund the amount.',
    };
    expect(
      validateCitationContract({
        ...common,
        operativeText: '3. Duty to refund.—The provider shall refund the amount.',
      }).passed,
    ).toBe(true);
    expect(
      validateCitationContract({ ...common, operativeText: '3. Duty to refund' }).passed,
    ).toBe(false);
  });
});
