import { RelevanceVerificationService } from './relevance-verification.service';

describe('RelevanceVerificationService', () => {
  const service = new RelevanceVerificationService();
  const consumerQuery = 'consumer banking complaint for an unauthorised UPI debit';

  it.each([
    ['Prevention of Money Laundering Act, 2002 Section 11', 'PMLA s.11'],
    ['Code of Civil Procedure, 1908 Section 35', 'CPC s.35'],
    ['Real Estate (Regulation and Development) Act, 2016 Section 40', 'RERA s.40'],
  ])('rejects off-point enactment %s', (title, citation) => {
    expect(
      service.assess({
        authority: { title, citation, fullText: `${title} provides an authority-specific remedy.` },
        query: consumerQuery,
        legalDomain: 'consumer banking',
      }),
    ).toEqual(expect.objectContaining({ state: 'OFF_POINT' }));
  });

  it('allows an enactment when the query expressly names it', () => {
    expect(
      service.assess({
        authority: {
          title: 'Prevention of Money Laundering Act, 2002 Section 11',
          citation: 'PMLA s.11',
        },
        query: 'Does PMLA section 11 apply to this bank account?',
        legalDomain: 'banking',
      }),
    ).toEqual(expect.objectContaining({ state: 'GOVERNS' }));
  });
});
