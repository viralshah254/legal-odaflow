import { CourtFeeCalculatorService } from './court-fee-calculator.service';
import { ForumJurisdictionResolverService } from './forum-jurisdiction-resolver.service';
import { MandatoryAnnexureResolverService } from './mandatory-annexure-resolver.service';

describe('India Order XXXVII commercial summary-suit rules', () => {
  const kind = 'india_suit_recovery_cpc_37';

  it('resolves only a designated commercial forum when specified value is met', () => {
    const result = new ForumJurisdictionResolverService().resolve(
      kind,
      'IN',
      1250000,
      'Delhi',
      'Invoices were payable and the defendant carries on business in Delhi.',
    );

    expect(result.hasJurisdiction).toBe(true);
    expect(result.pecuniaryJurisdiction).toBe(true);
    expect(result.correctForum).toMatch(/Commercial Court|Commercial Division/);
    expect(result.notes.join(' ')).toContain('state notification');
  });

  it('flags a below-floor claim and an undesignated ordinary court', () => {
    const result = new ForumJurisdictionResolverService().resolve(
      kind,
      'IN',
      250000,
      'District Court, Delhi',
      'The invoice debt arose in Delhi.',
    );

    expect(result.hasJurisdiction).toBe(false);
    expect(result.pecuniaryJurisdiction).toBe(false);
    expect(result.warnings.join(' ')).toContain('Rs.3,00,000');
    expect(result.warnings.join(' ')).toContain('designated Commercial Court');
  });

  it('does not invent a nationwide percentage court fee', () => {
    const result = new CourtFeeCalculatorService().calculate(kind, 'IN', 1250000);

    expect(result.applicable).toBe(true);
    expect(result.feeAmount).toBeUndefined();
    expect(result.calculationBasis).toContain('exact state slab calculation required');
    expect(result.notes.join(' ')).toContain('No uniform national percentage applies');
  });

  it('returns the filing-set-specific mandatory documents', () => {
    const result = new MandatoryAnnexureResolverService().resolve(kind, 'IN');
    const required = result.required.join(' ');

    expect(required).toContain('Written instrument');
    expect(required).toContain('Invoices');
    expect(required).toContain('Section 12A');
    expect(required).toContain('Statement of Truth');
    expect(required).toContain('court-fee payment');
  });
});
