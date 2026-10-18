import { BailSectionResolverService } from '@/ai/bail-section-resolver.service';
import { LegalSectionRouterService } from '@/ai/legal-section-router.service';

describe('LegalSectionRouterService golden India regressions', () => {
  const service = new LegalSectionRouterService(new BailSectionResolverService());

  it('selects warrant-case guilty plea section for robbery, not summons-case BNSS 275', () => {
    const result = service.resolve({
      countryCode: 'IN',
      consumer: 'legal_research',
      rawFacts:
        'FIR alleges robbery under IPC 392 / BNS 309. The matter is a warrant case before the Magistrate and the accused wants to plead guilty.',
    });

    expect(result.governingSections.some((s) => s.actId === 'bnss' && s.section === '264')).toBe(true);
    expect(result.governingSections.some((s) => s.actId === 'bnss' && s.section === '275')).toBe(false);
    expect(result.governingSections.some((s) => s.actId === 'bns' && s.section === '309')).toBe(true);
  });

  it('selects Sessions guilty plea section for Sessions trial facts', () => {
    const result = service.resolve({
      countryCode: 'IN',
      consumer: 'legal_research',
      rawFacts:
        'Sessions trial for robbery where the accused proposes to plead guilty before the Court of Sessions.',
    });

    expect(result.governingSections.some((s) => s.actId === 'bnss' && s.section === '252')).toBe(true);
  });

  it('keeps cheque bounce under NI Act 138 instead of BNS 138', () => {
    const result = service.resolve({
      countryCode: 'IN',
      consumer: 'india_draft_v1',
      rawFacts: 'Cheque bounce complaint for dishonour of cheque under section 138.',
    });

    expect(result.governingSections.some((s) => s.actId === 'ni_act' && s.section === '138')).toBe(true);
    expect(result.governingSections.some((s) => s.actId === 'bns' && s.section === '138')).toBe(false);
  });

  it('resolves murder bail as serious Sessions/HC bail context when forum is superior court', () => {
    const result = service.resolve({
      countryCode: 'IN',
      consumer: 'india_draft_v1',
      documentKind: 'india_regular_bail_bnss_480',
      courtName: 'Sessions Court, Ahmedabad',
      rawFacts: 'Regular bail in an offence under IPC 302 after arrest.',
    });

    expect(result.bailResolution?.section).toBe('483');
    expect(result.governingSections.some((s) => s.actId === 'bns' && s.section === '101')).toBe(true);
  });

  it('does not route workplace harassment through BNS for an employment research query', () => {
    const result = service.resolve({
      countryCode: 'IN',
      consumer: 'legal_research',
      legalDomain: 'EMPLOYMENT',
      rawFacts:
        'Employee alleges wrongful termination, workplace harassment, and unpaid incentives. Preserve evidence of the internal complaint.',
    });

    expect(result.governingSections.some((s) => ['bns', 'bnss', 'bsa'].includes(s.actId))).toBe(false);
  });
});
