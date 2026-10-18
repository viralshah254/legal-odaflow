import { checkDomainCompleteness } from './domain-completeness-checker';

describe('checkDomainCompleteness', () => {
  it('does not infer banking coverage from generated text for an arbitration query', () => {
    const gaps = checkDomainCompleteness({
      query:
        'What cases enforced arbitration clauses in Indian partnership agreements?',
      outputMarkdown:
        'An unrelated generated paragraph mentioned banking, UPI, RBI, and a regulated entity.',
      countryCode: 'IN',
      legalDomain: 'ARBITRATION',
    });

    expect(gaps).toEqual([]);
  });

  it('still applies the banking checklist when the user query requests it', () => {
    const gaps = checkDomainCompleteness({
      query: 'What remedies apply to an unauthorised UPI transaction by my bank?',
      outputMarkdown: 'The bank should investigate the transaction.',
      countryCode: 'IN',
      legalDomain: 'CONSUMER',
    });

    expect(gaps.map((gap) => gap.id)).toContain('rbi_integrated_ombudsman');
  });

  it('selects arbitration requirements from the classified domain', () => {
    const gaps = checkDomainCompleteness({
      query: 'Can this arbitration clause be enforced through section 11?',
      outputMarkdown: 'The parties should review their options.',
      countryCode: 'IN',
      legalDomain: 'ARBITRATION',
    });

    expect(gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining([
        'arbitration_agreement_scope',
        'arbitration_procedural_route',
      ]),
    );
  });

  it('requires current-law qualification only when the query asks for it', () => {
    const gaps = checkDomainCompleteness({
      query: 'Is this case still good law under the current position?',
      outputMarkdown: 'The case states a rule.',
      countryCode: 'IN',
      legalDomain: 'CIVIL_LITIGATION',
    });

    expect(gaps.map((gap) => gap.id)).toContain('current_law_status');
  });

  it.each(['US', 'GB', 'KE'])(
    'applies the universal completeness requirements in %s, not only India',
    (countryCode) => {
      const gaps = checkDomainCompleteness({
        query: 'Is this arrest lawful and is the authority still good law currently?',
        outputMarkdown: 'The arrest happened.',
        countryCode,
        legalDomain: 'CRIMINAL',
      });

      expect(gaps.map((gap) => gap.id)).toEqual(
        expect.arrayContaining(['current_law_status', 'criminal_elements_and_forum']),
      );
    },
  );

  it('does not impose India-specific regulator checklists on other jurisdictions', () => {
    const indiaGaps = checkDomainCompleteness({
      query: 'What remedies apply to an unauthorised UPI transaction by my bank?',
      outputMarkdown: 'The bank should investigate the transaction.',
      countryCode: 'IN',
      legalDomain: 'CONSUMER',
    });
    const usGaps = checkDomainCompleteness({
      query: 'What remedies apply to an unauthorised UPI transaction by my bank?',
      outputMarkdown: 'The bank should investigate the transaction.',
      countryCode: 'US',
      legalDomain: 'CONSUMER',
    });

    expect(indiaGaps.map((gap) => gap.id)).toContain('rbi_integrated_ombudsman');
    expect(usGaps.map((gap) => gap.id)).not.toContain('rbi_integrated_ombudsman');
    expect(usGaps.map((gap) => gap.id)).toContain('regulated_entity_complaint');
  });
});
