/**
 * Deterministic commercial-recovery regression. Keep this fixture free of
 * inferred delivery dates, court-fee figures, and a fabricated court name.
 */
export const APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE = `
Draft a commercial summary suit for recovery under Order XXXVII CPC for Apex
Packaging Solutions Private Limited against Zenith Retail Private Limited.
Apex is registered in Ahmedabad and Zenith is registered in Mumbai. Zenith
placed Purchase Order No. ZR/PO/1187/2025 dated 15 September 2025 for
customised packaging worth ₹32,50,000, deliverable to its Sanand, Gujarat
warehouse. Payment was due 30 days after delivery with contractual interest at
18% per annum.

Apex supplied the order under Invoice APS/2451 dated 5 October 2025 for
₹12,00,000, Invoice APS/2518 dated 20 October 2025 for ₹10,50,000, and Invoice
APS/2594 dated 2 November 2025 for ₹10,00,000. Signed and stamped delivery
challans exist, but their dates are not provided. Zenith accepted the goods
without protest. It paid ₹7,50,000 on 10 December 2025 and promised by email to
clear the balance by 31 December 2025. On 8 January 2026 its CFO acknowledged
by WhatsApp that ₹25,00,000 remained payable.

Apex's demand notice dated 20 March 2026 was delivered on 24 March 2026.
Section 12A pre-institution mediation was filed on 15 April 2026 and a
non-starter report issued on 30 May 2026. Filing is proposed for 15 July 2026
before the competent Commercial Court in Ahmedabad, Gujarat. Use [BLANK] for
the exact court designation, pecuniary-jurisdiction particulars, applicable
court fee, delivery dates, and any interest calculation that depends on those
missing delivery dates. Do not allege fraud or criminal conduct.
`.trim();

export const APEX_ZENITH_INSUFFICIENT_FORUM_INTAKE = `
Apex Packaging Solutions Private Limited supplied packaging to Zenith Retail
Private Limited under a written purchase order. ₹25,00,000 remains unpaid.
Draft recovery proceedings in India. The place of contracting, delivery,
defendant's office, specified value, territorial jurisdiction facts, payment
due date, and pre-institution mediation status are not provided.
`.trim();

export const APEX_ZENITH_ORDINARY_RECOVERY_INTAKE = `
A supplier in Ahmedabad seeks recovery of ₹25,00,000 for goods allegedly
supplied on oral instructions. No written contract, purchase order, invoice,
negotiable instrument, acknowledgment, or other written debt instrument is
available. Determine the appropriate civil recovery pleading without assuming
that Order XXXVII CPC applies.
`.trim();

export const APEX_ZENITH_REQUIRED_OUTPUT_PATTERNS: RegExp[] = [
  /Apex Packaging Solutions Private Limited/i,
  /Zenith Retail Private Limited/i,
  /Order XXXVII/i,
  /commercial dispute/i,
  /Commercial Courts Act,\s*2015/i,
  /Section 12A/i,
  /Ahmedabad|Sanand|Gujarat/i,
  /₹\s*25,00,000|Rs\.?\s*25,00,000/i,
  /18%\s*(?:per annum|p\.?a\.?)/i,
  /pendente lite/i,
  /future interest/i,
  /cause of action/i,
  /limitation/i,
  /valuation/i,
  /court fee/i,
  /verification/i,
  /statement of truth/i,
  /affidavit/i,
  /list of documents|annexures?/i,
  /ZR\/PO\/1187\/2025/i,
  /APS\/2451/i,
  /APS\/2518/i,
  /APS\/2594/i,
  /delivery challans?/i,
  /email/i,
  /WhatsApp/i,
  /non-starter report/i,
];

export const APEX_ZENITH_FORBIDDEN_OUTPUT_PATTERNS: RegExp[] = [
  /family court/i,
  /marriage|matrimonial|divorce/i,
  /maintenance under|interim maintenance/i,
  /husband|wife/i,
  /\bFIR\b|criminal revision|chargesheet|\bbail\b/i,
  /\bBNS\b|\bBNSS\b|\bCrPC\b|\bIPC\b/i,
  /\bSEBI\b|delisting/i,
  /set[- ]?off|counterclaim/i,
  /fraud|cheating|criminal breach of trust/i,
  /Section 138|Negotiable Instruments Act/i,
];

/**
 * Static output used only to validate structure and leakage without an LLM.
 * Missing particulars remain descriptive blanks.
 */
export const APEX_ZENITH_COMMERCIAL_RECOVERY_GOLDEN = `
IN THE COURT OF [BLANK: exact designation of competent Commercial Court] AT AHMEDABAD, GUJARAT
COMMERCIAL SUMMARY SUIT NO. [BLANK: number] OF 2026

APEX PACKAGING SOLUTIONS PRIVATE LIMITED                         ...PLAINTIFF
VERSUS
ZENITH RETAIL PRIVATE LIMITED                                   ...DEFENDANT

PLAINT UNDER ORDER XXXVII OF THE CODE OF CIVIL PROCEDURE, 1908

LIST OF DATES
15 September 2025 — Purchase Order ZR/PO/1187/2025.
5 October 2025 — Invoice APS/2451 for ₹12,00,000.
20 October 2025 — Invoice APS/2518 for ₹10,50,000.
2 November 2025 — Invoice APS/2594 for ₹10,00,000.
10 December 2025 — Part-payment of ₹7,50,000 and email acknowledgment.
8 January 2026 — WhatsApp acknowledgment of ₹25,00,000.
20 March 2026 — Demand notice, delivered 24 March 2026.
15 April 2026 — Section 12A mediation application.
30 May 2026 — Non-starter report.

COMMERCIAL DISPUTE AND MAINTAINABILITY
The claim arises from an ordinary transaction of merchants and traders and is
a commercial dispute under the Commercial Courts Act, 2015. It seeks a
liquidated debt arising from the written purchase order and invoices and is
maintainable under Order XXXVII CPC.

JURISDICTION
The goods were deliverable to and accepted at Sanand, Gujarat. The competent
Ahmedabad Commercial Court has territorial jurisdiction on that basis. Its
exact designation and pecuniary-jurisdiction particulars are
[BLANK: confirm from applicable allocation and specified-value rules].

PRE-INSTITUTION MEDIATION
The Plaintiff complied with Section 12A of the Commercial Courts Act, 2015.
A non-starter report issued on 30 May 2026.

FACTS AND CAUSE OF ACTION
The invoice total was ₹32,50,000. After crediting ₹7,50,000, the admitted
principal balance is ₹25,00,000. Signed delivery challans and the email and
WhatsApp acknowledgments support the claim. The cause of action arose upon
non-payment and continued through the acknowledgments and demand notice.

LIMITATION
The proposed filing date is 15 July 2026. The suit is within limitation on the
dates supplied, subject to pleading the exact delivery and contractual due
dates from the delivery challans.

VALUATION, COURT FEE, AND INTEREST
The principal claim is valued at ₹25,00,000, plus contractual interest at 18%
per annum. The exact pre-suit interest must be calculated after inserting
[BLANK: delivery dates and resulting contractual due dates]. Court fee is
[BLANK: amount under the applicable Gujarat court-fee law].

PRAYER
Pass a summary decree for ₹25,00,000 with properly calculated pre-suit
contractual interest, pendente lite and future interest, and costs.

VERIFICATION
[BLANK: authorised representative] verifies the pleaded facts at Ahmedabad.

STATEMENT OF TRUTH
The authorised representative makes the prescribed Commercial Court Statement
of Truth, subject to [BLANK: name, designation, authority, date, and execution particulars].

SUPPORTING AFFIDAVIT
[BLANK: authorised representative] affirms the facts stated in the plaint.

LIST OF DOCUMENTS AND ANNEXURES
Purchase order; three invoices; signed delivery challans; email acknowledgment;
WhatsApp acknowledgment; demand notice and delivery proof; Section 12A
application; and non-starter report.
`.trim();

export const APEX_ZENITH_LEAKY_BAD_DRAFT = `
IN THE FAMILY COURT AT AHMEDABAD
Apex Packaging Solutions Private Limited versus Zenith Retail Private Limited
PETITION FOR INTERIM MAINTENANCE
The wife seeks maintenance under BNSS and requests registration of an FIR for
cheating. In the alternative, Zenith may file a set-off and counterclaim or a
SEBI delisting petition.
`.trim();

export const APEX_ZENITH_UNSAFE_FILING_DRAFT = `
IN THE DISTRICT COURT, AHMEDABAD
COMMERCIAL DISPUTE AND MAINTAINABILITY
The claim arises from Invoice APS/2612 for ₹12,00,000 and Invoice APS/2789.
JURISDICTION
The Plaintiff has its registered office at Ahmedabad.
LIMITATION
The cause of action continues daily.
VALUATION AND COURT FEE
The suit is valued at ₹25,00,000; court fee is [BLANK].
INTERIM APPLICATION UNDER ORDER XXXVII RULE 2
The Defendant is in financial distress and is dishonestly dissipating assets.
Although mediation concluded with a non-starter report, urgent interim relief
means that the Section 12A exception applies.
PRAYER
Award ₹₹,; with interest.
VERIFICATION
STATEMENT OF TRUTH
SUPPORTING AFFIDAVIT
LIST OF DOCUMENTS
`.trim();
