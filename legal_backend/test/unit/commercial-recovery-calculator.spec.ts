import {
  buildCommercialRecoveryFactLock,
  calculateCommercialRecoveryClaim,
  formatCommercialRecoveryCalculation,
} from '@/ai/draft-intent/commercial-recovery-calculator';

const FACTS = `
Payment was to be made within 30 days of delivery. Interest at 18% per annum applies.
Invoice No. APS/2451 dated 5 October 2025 — ₹12,00,000
Invoice No. APS/2518 dated 20 October 2025 — ₹10,50,000
Invoice No. APS/2594 dated 2 November 2025 — ₹10,00,000
On 10 December 2025, Zenith paid ₹7,50,000.
Apex intends to institute proceedings on 15 July 2026.
`.trim();

describe('commercial recovery calculator', () => {
  it('reconciles invoice principal and oldest-invoice part-payment deterministically', () => {
    const result = calculateCommercialRecoveryClaim({
      facts: FACTS,
      deliveryBasis: 'invoice_dates',
      allocationMethod: 'oldest_invoice_first',
    });
    expect(result).toBeDefined();
    expect(result?.totalOriginalPrincipal).toBe(3_250_000);
    expect(result?.totalPayments).toBe(750_000);
    expect(result?.totalPrincipalOutstanding).toBe(2_500_000);
    expect(result?.invoices[0]).toMatchObject({
      invoiceNumber: 'APS/2451',
      originalPrincipal: 1_200_000,
      principalPaid: 750_000,
      principalOutstanding: 450_000,
    });
    expect(result?.totalPreSuitInterest).toBeGreaterThan(0);
    expect(result?.totalClaimAtFiling).toBe(
      2_500_000 + (result?.totalPreSuitInterest ?? 0),
    );
  });

  it('refuses to invent delivery dates or part-payment allocation', () => {
    expect(
      calculateCommercialRecoveryClaim({
        facts: FACTS,
        allocationMethod: 'oldest_invoice_first',
      }),
    ).toBeUndefined();

    const unresolved = calculateCommercialRecoveryClaim({
      facts: FACTS,
      deliveryBasis: 'invoice_dates',
      allocationMethod: 'no_agreed_allocation',
    });
    expect(unresolved?.issues).toContain(
      'Part-payment allocation is not arithmetically determinable from the confirmed inputs.',
    );
  });

  it('formats a generation-safe schedule with reconciled totals', () => {
    const result = calculateCommercialRecoveryClaim({
      facts: FACTS,
      deliveryBasis: 'invoice_dates',
      allocationMethod: 'oldest_invoice_first',
    });
    expect(formatCommercialRecoveryCalculation(result!)).toMatch(
      /Total principal outstanding: ₹2500000\.00/,
    );
  });

  it('locks invoice identifiers and blocks unconfirmed calculation assumptions', () => {
    const lock = buildCommercialRecoveryFactLock({ facts: FACTS });

    expect(lock.invoices.map((invoice) => invoice.invoiceNumber)).toEqual([
      'APS/2451',
      'APS/2518',
      'APS/2594',
    ]);
    expect(lock.payments[0]).toMatchObject({
      amount: 750_000,
      allocationMethod: 'unconfirmed',
    });
    expect(lock.calculation).toBeUndefined();
    expect(lock.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/delivery dates/i),
        expect.stringMatching(/appropriation method/i),
      ]),
    );
  });

  it('produces a reconciled confirmed fact lock without blockers', () => {
    const lock = buildCommercialRecoveryFactLock({
      facts: FACTS,
      deliveryBasis: 'invoice_dates',
      allocationMethod: 'oldest_invoice_first',
      confirmed: true,
    });

    expect(lock.source).toBe('lawyer_confirmed');
    expect(lock.blockingIssues).toEqual([]);
    expect(lock.calculation?.totalPrincipalOutstanding).toBe(2_500_000);
  });
});
