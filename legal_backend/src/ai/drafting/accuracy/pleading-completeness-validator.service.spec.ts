import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import {
  PleadingCompletenessValidatorService,
  splitDraftSections,
} from './pleading-completeness-validator.service';

/** Exact stub pattern from broken filing-set consumer complaint. */
const HOLLOW_RIYA_DRAFT = `
## CAUSE TITLE
BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD

## PARTIES
Complainant: Riya Desai
Opposite Parties: Sunrise Multispeciality Hospital; Dr. Mahesh Trivedi; Dr. Kavita Rao

## STATEMENT OF FACTS
Riya Desai

## GROUNDS
for specific risks is blank

## PRAYER
a) Direct Opposite Parties to pay compensation.
b) Cost of the complaint.

## VERIFICATION
Verified at Ahmedabad.
`;

describe('PleadingCompletenessValidatorService — hollow sections', () => {
  const validator = new PleadingCompletenessValidatorService();

  it('splitDraftSections finds FACTS and GROUNDS', () => {
    const slices = splitDraftSections(HOLLOW_RIYA_DRAFT);
    expect(slices.some((s) => /facts/i.test(s.title))).toBe(true);
    expect(slices.some((s) => /grounds/i.test(s.title))).toBe(true);
  });

  it('flags SECTION_STUB_OR_EMPTY for lone-name FACTS and blank GROUNDS', () => {
    const result = validator.evaluate({
      draftText: HOLLOW_RIYA_DRAFT,
      documentKind: 'india_consumer_complaint',
      requiredSections: ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    });

    const stubs = result.findings.filter(
      (f) => f.code === ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
    );
    expect(stubs.length).toBeGreaterThanOrEqual(2);
    expect(result.passed).toBe(false);
    expect(stubs.some((f) => /facts/i.test(f.sectionHint ?? f.message))).toBe(true);
    expect(stubs.some((f) => /grounds/i.test(f.sectionHint ?? f.message))).toBe(true);
  });

  it('passes substantive FACTS/GROUNDS', () => {
    const ok = `
## STATEMENT OF FACTS
1. On 10 March 2025 the Complainant underwent laparoscopic cholecystectomy at Sunrise Multispeciality Hospital, Ahmedabad.
2. Consent for the procedure was recorded on 9 March 2025.
3. Post-operative bile leak was diagnosed on 13 March 2025 and the Complainant incurred expenses of ₹1,80,000.
4. Opposite Parties failed to disclose specific risks of bile-duct injury.

## GROUNDS
A. Deficiency in service under the Consumer Protection Act, 2019 arising from inadequate informed consent and post-operative care.
B. Unfair trade practice in failing to maintain proper medical records of the procedure and complications.
C. The Complainant is entitled to compensation for medical expenses, mental agony, and costs of this complaint.
`;
    const result = validator.evaluate({
      draftText: ok,
      documentKind: 'india_consumer_complaint',
      requiredSections: ['FACTS', 'GROUNDS'],
    });
    const stubs = result.findings.filter(
      (f) => f.code === ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
    );
    expect(stubs).toHaveLength(0);
  });
});
