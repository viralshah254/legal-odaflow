import {
  isSpecificPerformancePropertyDispute,
  resolveDocumentBundle,
  shouldExcludeDraftIntentMatch,
  SPECIFIC_PERFORMANCE_FILING_BUNDLE,
} from '@/ai/draft-intent/draft-intent-bundles';
import type { DraftIntentMatch } from '@/ai/draft-intent/draft-intent.types';

export const KAVITA_SPECIFIC_PERFORMANCE_FACTS = `
Mrs. Kavita Shah agreed to purchase a residential plot from Mr. Rakesh Mehta for ₹45 lakhs.
An Agreement to Sell was executed on 10 March 2024.
Kavita paid ₹20 lakhs as advance.
Before execution of the sale deed, Rakesh sold the property to a third party.
Kavita wants:
* Specific performance
* Injunction
* Alternatively damages
`.trim();

describe('draft-intent-bundles', () => {
  it('detects Kavita specific performance property dispute', () => {
    expect(isSpecificPerformancePropertyDispute(KAVITA_SPECIFIC_PERFORMANCE_FACTS)).toBe(true);
  });

  it('returns a three-document filing bundle', () => {
    const bundle = resolveDocumentBundle(undefined, KAVITA_SPECIFIC_PERFORMANCE_FACTS);
    expect(bundle).toHaveLength(3);
    expect(bundle?.map((b) => b.kind)).toEqual([
      'india_legal_notice',
      'india_civil_plaint',
      'india_application_temp_injunction',
    ]);
  });

  it('excludes rent and arbitration matches for property suits', () => {
    const rentMatch: DraftIntentMatch = {
      type: 'official_form',
      confidence: 0.8,
      summary: 'Kerala — Rent Control Petition (IN-KL-RENT)',
      formId: 'x',
      formName: 'Rent Control Petition',
      formNumber: 'IN-KL-RENT',
      countryCode: 'IN',
      authority: 'Kerala High Court',
      draftUrl: '/app/india-drafting/draft',
    };
    expect(
      shouldExcludeDraftIntentMatch(rentMatch, undefined, KAVITA_SPECIFIC_PERFORMANCE_FACTS),
    ).toBe(true);
  });

  it('does not exclude unrelated matches outside property context', () => {
    const rentMatch: DraftIntentMatch = {
      type: 'official_form',
      confidence: 0.8,
      summary: 'Kerala — Rent Control Petition (IN-KL-RENT)',
      formId: 'x',
      formName: 'Rent Control Petition',
      formNumber: 'IN-KL-RENT',
      countryCode: 'IN',
      authority: 'Kerala High Court',
      draftUrl: '/app/india-drafting/draft',
    };
    expect(shouldExcludeDraftIntentMatch(rentMatch, undefined, 'tenant eviction notice')).toBe(
      false,
    );
  });
});

describe('SPECIFIC_PERFORMANCE_FILING_BUNDLE', () => {
  it('defaults all bundle items to selected', () => {
    expect(SPECIFIC_PERFORMANCE_FILING_BUNDLE.every((item) => item.selectedByDefault)).toBe(true);
  });
});
