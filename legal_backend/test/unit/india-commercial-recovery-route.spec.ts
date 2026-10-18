import {
  buildCommercialRecoveryQuestions,
  buildIndiaCommercialRecoveryRoute,
  isIndiaCommercialRecoveryQuery,
} from '@/ai/draft-intent/india-commercial-recovery-route';

const APEX_ZENITH = `
Act as an advocate representing the claimant. Draft a complete commercial summary suit
for recovery under Order XXXVII CPC before the competent Commercial Court in Ahmedabad.
Apex supplied customised packaging under Purchase Order ZR/PO/1187/2025:
Invoice No. APS/2451 dated 5 October 2025 — ₹12,00,000
Invoice No. APS/2518 dated 20 October 2025 — ₹10,50,000
Invoice No. APS/2594 dated 2 November 2025 — ₹10,00,000
Zenith accepted delivery and on 10 December 2025 paid ₹7,50,000 as a part-payment.
Zenith acknowledged the ₹25,00,000 balance by email
and WhatsApp, and failed to pay. Interest is 18% per annum. Section 12A pre-institution
mediation ended in a non-starter report. Proceedings are intended on 15 July 2026.
`.trim();

describe('India commercial recovery route', () => {
  it('routes an express Order XXXVII claim to the specific summary-suit kind', () => {
    const route = buildIndiaCommercialRecoveryRoute(APEX_ZENITH);
    expect(route).toMatchObject({
      practiceArea: 'corporate_commercial',
      subPracticeArea: 'commercial_recovery',
      partyRole: 'claimant',
      proceedingType: 'summary_suit',
      documentKind: 'summary_suit_recovery',
      draftKind: 'india_suit_recovery_cpc_37',
      forum: 'commercial_court',
    });
    expect(route?.supportingDocumentLabels).toEqual(
      expect.arrayContaining([
        'Statement of Truth',
        'Supporting affidavit',
        'List/index of documents and annexures',
      ]),
    );
  });

  it('asks only commercial calculation/forum questions and blocks until resolved', () => {
    const route = buildIndiaCommercialRecoveryRoute(APEX_ZENITH);
    const questions = buildCommercialRecoveryQuestions(route);
    expect(route?.blockingIssues.length).toBeGreaterThan(0);
    expect(questions.map((question) => question.id)).toEqual(
      expect.arrayContaining([
        'commercial_delivery_dates',
        'commercial_part_payment_allocation',
        'commercial_court_designation',
      ]),
    );
    expect(JSON.stringify(questions)).not.toMatch(
      /marriage|matrimonial|maintenance|criminal revision|bail|sebi/i,
    );
  });

  it('unblocks once decisive answers are supplied', () => {
    const route = buildIndiaCommercialRecoveryRoute(APEX_ZENITH, {
      commercial_delivery_dates: 'invoice_dates',
      commercial_part_payment_allocation: 'oldest_invoice_first',
      commercial_court_designation: 'designated_commercial_court',
    });
    expect(route?.blockingIssues).toEqual([]);
  });

  it('does not capture family or criminal matters merely because they are filings', () => {
    expect(
      isIndiaCommercialRecoveryQuery(
        'File a petition challenging interim maintenance before the Family Court.',
      ),
    ).toBe(false);
    expect(
      isIndiaCommercialRecoveryQuery(
        'Prepare a criminal revision against a Magistrate order.',
      ),
    ).toBe(false);
  });
});
