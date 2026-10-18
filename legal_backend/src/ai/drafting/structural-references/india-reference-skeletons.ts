/**
 * Curated structural reference skeletons for India court documents.
 *
 * Each skeleton provides a minimal "correct example" that is injected into the
 * pass-1 prompt as a REFERENCE STRUCTURE block. The AI copies this structure
 * and fills in the facts and verified authorities, rather than inventing structure.
 *
 * Rules for adding skeletons:
 * - Use correct cause title vehicle verbatim.
 * - Include the 2-3 governing sections that MUST appear.
 * - Show exactly one ground as an example label — AI adds the rest.
 * - Use [BLANK: description] for all missing facts.
 * - Party designators must match the document kind (Petitioner vs Appellant vs Applicant).
 */

export interface IndiaDraftSkeleton {
  /** Document kind slug this skeleton applies to. */
  kind: string;
  /** The exact string that must appear as the cause title vehicle. */
  causeTitleVehicle: string;
  /** Sections that MUST appear in the output. */
  mandatorySections: string[];
  /** Correct party designators: left side (Petitioner/Appellant/Plaintiff/etc.) */
  petitionerDesignator: string;
  /** Correct party designators: right side */
  respondentDesignator: string;
  /** Minimal structural example — passed verbatim to the LLM. */
  referenceText: string;
}

export const INDIA_REFERENCE_SKELETONS: IndiaDraftSkeleton[] = [
  // ─── Police FIR complaint ────────────────────────────────────────────────────
  {
    kind: 'india_fir_complaint',
    causeTitleVehicle: 'COMPLAINT FOR REGISTRATION OF FIR',
    mandatorySections: ['BNSS §173'],
    petitionerDesignator: 'Complainant',
    respondentDesignator: 'Accused',
    referenceText: `To,
The Station House Officer,
[BLANK: police station name], [BLANK: district / city]

COMPLAINT FOR REGISTRATION OF FIR
Under Section 173 of the Bharatiya Nagarik Suraksha Sanhita, 2023
read with [BLANK: governing substantive section from facts — e.g. BNS §78 if stalking]

Complainant: [BLANK: full name], aged about [BLANK: age] years, residing at [BLANK: address]
Accused: [BLANK: full name / description], aged about [BLANK: age] years, residing at [BLANK: address]

FACTS

1. The Complainant and the Accused are [BLANK: relationship — e.g. neighbours]. There is no [BLANK: other relationship if stated].
2. On or about [BLANK: date/time], at [BLANK: place], the Accused [BLANK: conduct from intake only — do not invent].
3. [BLANK: further material facts if any; otherwise omit]

LEGAL GROUNDS

The above acts, if proved, attract [BLANK: BNS/special-act section from AUTHORITATIVE SECTIONS only]. Information of a cognizable offence is required to be recorded under BNSS §173.

PRAYER

The Complainant respectfully prays that the Station House Officer may be pleased to:
(a) Record this information and register an FIR under BNSS §173;
(b) Investigate the offence in accordance with law;
(c) Provide a copy of the FIR to the Complainant;
(d) Take such other lawful steps as may be necessary for the safety of the Complainant.

Place: [BLANK]
Date: [BLANK]

                                                            [BLANK: complainant signature / name]`,
  },

  {
    kind: 'india_complaint_magistrate_bnss_223',
    causeTitleVehicle: 'COMPLAINT UNDER BNSS §223',
    mandatorySections: ['BNSS §223'],
    petitionerDesignator: 'Complainant',
    respondentDesignator: 'Accused',
    referenceText: `IN THE COURT OF THE [BLANK: Magistrate], [BLANK: place]
COMPLAINT UNDER SECTION 223 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023

BETWEEN:

[BLANK: complainant]                                         ...Complainant

                    versus

[BLANK: accused]                                             ...Accused

FACTS

1. [BLANK: material facts from intake only]

OFFENCE

The Accused has committed offence(s) punishable under [BLANK: section from grounding].

PRAYER

Take cognizance under BNSS §223 and issue process.

                                                            [BLANK: verification]`,
  },

  // ─── Criminal Revision ───────────────────────────────────────────────────────
  {
    kind: 'india_maintenance_order_revision',
    causeTitleVehicle: 'CRIMINAL REVISION PETITION',
    mandatorySections: ['BNSS §438', 'BNSS §144'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE HIGH COURT OF [BLANK: state] AT [BLANK: city]
CRIMINAL REVISION PETITION NO. [BLANK: petition number] OF [BLANK: year]

Under Section 438 of the Bharatiya Nagarik Suraksha Sanhita, 2023
against the interim order dated [BLANK: order date] passed in [BLANK: case number]
by the [BLANK: court below name]

BETWEEN:

[BLANK: petitioner full name]                   ...Petitioner

                    versus

[BLANK: respondent full name]                   ...Respondent

GROUNDS OF REVISION

GROUND I: [ISSUE — whether the interim maintenance quantum fixed under BNSS §144 is excessive / legally unsustainable on the facts]

PRAYER

WHEREFORE, the Petitioner respectfully prays that this Hon'ble Court be pleased to:
(a) Call for and examine the records of [BLANK: court below] in [BLANK: case number];
(b) Set aside / modify the impugned interim order dated [BLANK: order date];
(c) [BLANK: any other relief]`,
  },

  // ─── Bail ────────────────────────────────────────────────────────────────────
  {
    kind: 'india_regular_bail_bnss_480',
    causeTitleVehicle: 'APPLICATION FOR BAIL',
    mandatorySections: ['BNSS §480 / §483 (forum-resolved)'],
    petitionerDesignator: 'Applicant/Accused',
    respondentDesignator: 'State',
    referenceText: `IN THE COURT OF [BLANK: court name]
APPLICATION FOR BAIL UNDER THE FORUM-RESOLVED BAIL PROVISION OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023
IN FIR NO. [BLANK: FIR number] DATED [BLANK: date] P.S. [BLANK: police station]

BETWEEN:

[BLANK: accused full name]                      ...Applicant/Accused

                    versus

State of [BLANK: state]                         ...Respondent

GROUNDS

GROUND I: [ISSUE — that the offence alleged is bailable / applicant has deep roots in the community]

PRAYER

That this Hon'ble Court be pleased to release the Applicant on bail upon such terms and conditions as this Court deems fit.`,
  },

  {
    kind: 'india_anticipatory_bail_bnss_482',
    causeTitleVehicle: 'APPLICATION FOR ANTICIPATORY BAIL',
    mandatorySections: ['BNSS §482'],
    petitionerDesignator: 'Applicant',
    respondentDesignator: 'State',
    referenceText: `IN THE [BLANK: Sessions Court / High Court] OF [BLANK: state]
APPLICATION FOR ANTICIPATORY BAIL UNDER SECTION 482 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023

BETWEEN:

[BLANK: applicant full name]                    ...Applicant

                    versus

State of [BLANK: state]                         ...Respondent

GROUNDS

GROUND I: [ISSUE — apprehension of arrest is based on mala fide / false allegations]

PRAYER

That this Hon'ble Court be pleased to direct that in the event of arrest of the Applicant, they shall be released on bail.`,
  },

  // ─── Writ ─────────────────────────────────────────────────────────────────────
  {
    kind: 'india_writ_petition_hc',
    causeTitleVehicle: 'WRIT PETITION',
    mandatorySections: ['Article 226'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE HIGH COURT OF [BLANK: state] AT [BLANK: city]
WRIT PETITION (CIVIL / CRIMINAL) NO. [BLANK: number] OF [BLANK: year]
[Under Article 226 of the Constitution of India]

BETWEEN:

[BLANK: petitioner full name]                   ...Petitioner

                    versus

[BLANK: respondent / authority name]            ...Respondent

GROUNDS

GROUND I: [ISSUE — that the impugned action / order is without jurisdiction / violates fundamental rights]

PRAYER

That this Hon'ble Court be pleased to:
(a) Issue a writ of [Certiorari / Mandamus / Prohibition / Quo Warranto] quashing [BLANK: impugned order / action];
(b) [BLANK: any other relief];
(c) Award costs.`,
  },

  {
    kind: 'india_slp_draft',
    causeTitleVehicle: 'SPECIAL LEAVE PETITION',
    mandatorySections: ['Article 136'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE SUPREME COURT OF INDIA
SPECIAL LEAVE PETITION (CIVIL / CRIMINAL) NO. [BLANK: number] OF [BLANK: year]
[Under Article 136 of the Constitution of India]

BETWEEN:

[BLANK: petitioner name]                        ...Petitioner

                    versus

[BLANK: respondent name]                        ...Respondent

QUESTIONS OF LAW

1. [ISSUE — whether the High Court erred in / failed to consider ...]

GROUNDS

GROUND I: [ISSUE — substantial question of law requiring determination by this Court]

PRAYER

That this Hon'ble Court be pleased to:
(a) Grant leave to appeal against the impugned judgment dated [BLANK: date];
(b) Stay the operation of the impugned judgment during the pendency of the SLP;
(c) [BLANK: final relief];
(d) Award costs.`,
  },

  // ─── Criminal appeal ─────────────────────────────────────────────────────────
  {
    kind: 'india_criminal_revision',
    causeTitleVehicle: 'CRIMINAL REVISION PETITION',
    mandatorySections: ['BNSS §438'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE HIGH COURT OF [BLANK: state] AT [BLANK: city]
CRIMINAL REVISION PETITION NO. [BLANK: number] OF [BLANK: year]
[Under Section 438 of the Bharatiya Nagarik Suraksha Sanhita, 2023]

BETWEEN:

[BLANK: petitioner name]                        ...Petitioner

                    versus

State of [BLANK: state] / [BLANK: respondent]  ...Respondent

GROUNDS OF REVISION

GROUND I: [ISSUE — that the impugned order / finding is illegal / contrary to settled law / perverse on the evidence]

PRAYER

That this Hon'ble Court be pleased to:
(a) Call for the records of [BLANK: lower court];
(b) Set aside / modify the impugned order dated [BLANK: date];
(c) [BLANK: other relief].`,
  },

  // ─── Consumer ────────────────────────────────────────────────────────────────
  {
    kind: 'india_consumer_complaint',
    causeTitleVehicle: 'CONSUMER COMPLAINT',
    mandatorySections: ['Consumer Protection Act 2019 §35'],
    petitionerDesignator: 'Complainant',
    respondentDesignator: 'Opposite Party',
    referenceText: `BEFORE THE [BLANK: District / State / National] CONSUMER DISPUTES REDRESSAL COMMISSION
[BLANK: city / location]
CONSUMER COMPLAINT NO. [BLANK: number] OF [BLANK: year]

IN THE MATTER OF:

[BLANK: complainant name]                       ...Complainant

                    versus

[BLANK: opposite party / company name]          ...Opposite Party

BRIEF FACTS

1. The Complainant is a consumer within the meaning of the Consumer Protection Act, 2019.
2. [BLANK: brief facts of deficiency in service / defective goods]

GROUNDS

GROUND I: [ISSUE — that the Opposite Party committed deficiency in service / sold defective goods]

PRAYER

That this Hon'ble Commission be pleased to:
(a) Direct the Opposite Party to [BLANK: refund / replace / compensate];
(b) Award compensation of Rs. [BLANK: amount];
(c) Award costs of Rs. [BLANK: costs amount].`,
  },

  // ─── Civil suit ───────────────────────────────────────────────────────────────
  {
    kind: 'india_suit_recovery_cpc_37',
    causeTitleVehicle: 'COMMERCIAL SUMMARY SUIT UNDER ORDER XXXVII CPC',
    mandatorySections: [
      'CPC Order XXXVII Rules 1–2',
      'Commercial Courts Act 2015 §12A',
      'CPC §20',
      'CPC §34',
      'Commercial Courts Act 2015 Statement of Truth',
    ],
    petitionerDesignator: 'Plaintiff',
    respondentDesignator: 'Defendant',
    referenceText: `IN THE [BLANK: designated Commercial Court / Commercial Division]
AT [BLANK: place]
COMMERCIAL SUMMARY SUIT NO. [BLANK: number] OF [BLANK: year]

IN THE MATTER OF:

[BLANK: plaintiff name and address]                         ...Plaintiff

                    versus

[BLANK: defendant name and address]                         ...Defendant

COMMERCIAL SUMMARY SUIT UNDER ORDER XXXVII OF THE
CODE OF CIVIL PROCEDURE, 1908

SYNOPSIS AND LIST OF DATES
[BLANK: chronological table of supplied contract, invoice, delivery, due, payment,
acknowledgment, notice and Section 12A mediation dates]

MAINTAINABILITY
1. The dispute is a commercial dispute of specified value because [BLANK: supplied commercial transaction and valuation facts].
2. This suit falls within Order XXXVII Rules 1 and 2 because the liquidated debt arises from [BLANK: supplied written contract / invoices / acknowledgment / negotiable instrument]. No relief outside Order XXXVII is claimed [BLANK: confirm from requested relief].

TERRITORIAL AND PECUNIARY JURISDICTION
3. This Court has territorial jurisdiction because [BLANK: defendant residence/business or supplied CPC §20 cause-of-action facts].
4. The suit is valued at Rs. [BLANK: reconciled claim value]. The chosen designated Commercial Court / Commercial Division has pecuniary jurisdiction because [BLANK: applicable state/court threshold].

LIMITATION
5. The cause accrued on [BLANK: supplied due/default date]. [BLANK: supplied acknowledgment or part-payment and legal effect, if applicable].

VALUATION AND COURT FEE
6. The suit is valued at Rs. [BLANK: schedule total]. Ad valorem court fee of Rs. [BLANK: amount computed under the applicable State schedule] is affixed.

PRE-INSTITUTION MEDIATION — SECTION 12A
7. [BLANK: supplied mediation application and outcome/non-starter particulars OR concrete urgent-interim-relief facts and exception basis].

MATERIAL FACTS AND CAUSE OF ACTION
8. [BLANK: numbered facts from CaseRecord only].

STATEMENT OF ACCOUNT / INVOICE-WISE SCHEDULE
| Invoice / written debt | Date | Due date | Principal | Payment / credit and date | Balance | Supported interest basis | Pre-suit interest |
| [BLANK] | [BLANK] | [BLANK] | Rs. [BLANK] | Rs. [BLANK] | Rs. [BLANK] | [BLANK] | Rs. [BLANK] |
TOTAL PRINCIPAL: Rs. [BLANK: arithmetic total]
TOTAL SUPPORTED PRE-SUIT INTEREST: Rs. [BLANK: arithmetic total]
TOTAL SUIT VALUATION: Rs. [BLANK: principal plus supported pre-suit interest]

PRAYER
The Plaintiff prays for:
(a) a decree for Rs. [BLANK: reconciled principal] and Rs. [BLANK: supported pre-suit interest];
(b) pendente lite and future interest under CPC §34 at [BLANK: supported/requested rate or rate left to Court];
(c) costs; and
(d) [BLANK: other relief maintainable under Order XXXVII, if any].

VERIFICATION
[BLANK: paragraph ranges and basis of knowledge]

STATEMENT OF TRUTH
[BLANK: prescribed Commercial Court Statement of Truth identifying personal knowledge, records and legal advice]

SUPPORTING AFFIDAVIT
[BLANK: deponent and attestation particulars]

INDEX AND LIST OF ANNEXURES
[BLANK: index only supplied written contract, invoices, delivery records, ledger,
payment proof, acknowledgment, notice/service proof, Section 12A papers and
corporate authorisation, as applicable]`,
  },

  {
    kind: 'india_civil_suit_recovery',
    causeTitleVehicle: 'PLAINT',
    mandatorySections: ['CPC Order VII Rule 1'],
    petitionerDesignator: 'Plaintiff',
    respondentDesignator: 'Defendant',
    referenceText: `IN THE COURT OF [BLANK: Civil Judge / District Judge]
[BLANK: city]
CIVIL SUIT NO. [BLANK: number] OF [BLANK: year]

BETWEEN:

[BLANK: plaintiff name]                         ...Plaintiff

                    versus

[BLANK: defendant name]                         ...Defendant

PLAINT

MOST RESPECTFULLY SHOWETH:

1. The Plaintiff is [BLANK: brief description].
2. The Defendant is liable to pay a sum of Rs. [BLANK: amount] on account of [BLANK: cause of action].

CAUSE OF ACTION

The cause of action arose on [BLANK: date] when [BLANK: brief facts].

PRAYER

That this Hon'ble Court be pleased to:
(a) Decree the suit in favour of the Plaintiff for Rs. [BLANK: amount] with interest at [BLANK: rate]% p.a.;
(b) Award costs of the suit;
(c) [BLANK: other relief].`,
  },

  // ─── Family ───────────────────────────────────────────────────────────────────
  {
    kind: 'india_divorce_petition_hma',
    causeTitleVehicle: 'PETITION FOR DIVORCE',
    mandatorySections: ['Hindu Marriage Act 1955 §13'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE FAMILY COURT AT [BLANK: city]
PETITION NO. [BLANK: number] OF [BLANK: year]
[Under Section 13 of the Hindu Marriage Act, 1955]

BETWEEN:

[BLANK: petitioner name]                        ...Petitioner

                    versus

[BLANK: respondent name]                        ...Respondent

FACTS

1. The parties were married on [BLANK: marriage date] at [BLANK: place] according to Hindu rites.
2. [BLANK: ground for divorce — cruelty / desertion / adultery / irretrievable breakdown etc.]

PRAYER

That this Hon'ble Court be pleased to:
(a) Pass a decree of divorce dissolving the marriage between the Petitioner and Respondent;
(b) [BLANK: custody / maintenance / other ancillary relief];
(c) Award costs.`,
  },

  {
    kind: 'india_maintenance_petition_hnss',
    causeTitleVehicle: 'PETITION FOR MAINTENANCE',
    mandatorySections: ['BNSS §144'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE COURT OF [BLANK: Judicial Magistrate / Family Court]
[BLANK: city]
PETITION NO. [BLANK: number] OF [BLANK: year]
[Under Section 144 of the Bharatiya Nagarik Suraksha Sanhita, 2023]

BETWEEN:

[BLANK: petitioner name]                        ...Petitioner

                    versus

[BLANK: respondent name]                        ...Respondent

FACTS

1. The Petitioner is the [wife / child / parent] of the Respondent.
2. The Respondent has [neglected / refused] to maintain the Petitioner despite having sufficient means.
3. The Petitioner requires maintenance of Rs. [BLANK: amount] per month.

PRAYER

That this Hon'ble Court be pleased to:
(a) Order the Respondent to pay maintenance of Rs. [BLANK: amount] per month to the Petitioner;
(b) [BLANK: interim maintenance during pendency];
(c) Award costs.`,
  },

  // ─── Cheque bounce ───────────────────────────────────────────────────────────
  {
    kind: 'india_cheque_bounce_ni138',
    causeTitleVehicle: 'COMPLAINT UNDER SECTION 138 NI ACT',
    mandatorySections: ['Negotiable Instruments Act §138', 'Negotiable Instruments Act §142'],
    petitionerDesignator: 'Complainant',
    respondentDesignator: 'Accused',
    referenceText: `IN THE COURT OF [BLANK: Judicial Magistrate First Class / Metropolitan Magistrate]
[BLANK: city]
COMPLAINT CASE NO. [BLANK: number] OF [BLANK: year]
[Under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881]

BETWEEN:

[BLANK: complainant name]                       ...Complainant

                    versus

[BLANK: accused / drawer name]                  ...Accused

COMPLAINT

1. The Complainant is a [individual / company] engaged in [BLANK: business].
2. The Accused issued Cheque No. [BLANK: cheque number] dated [BLANK: cheque date] for Rs. [BLANK: amount] drawn on [BLANK: bank name, branch].
3. The cheque was presented for encashment on [BLANK: date] and was dishonoured by the bank with the memo "[BLANK: dishonour memo reason]".
4. The Complainant issued a legal demand notice dated [BLANK: notice date] by [BLANK: mode — RPAD / email].
5. The Accused failed to make payment within 15 days of receipt.

PRAYER

That this Hon'ble Court be pleased to:
(a) Take cognizance of the offence under Section 138 of the NI Act;
(b) Issue summons to the Accused;
(c) Convict and sentence the Accused to imprisonment and / or fine as provided under the NI Act.`,
  },

  // ─── Arbitration ─────────────────────────────────────────────────────────────
  {
    kind: 'india_arbitration_petition_s9',
    causeTitleVehicle: 'ARBITRATION PETITION',
    mandatorySections: ['Arbitration and Conciliation Act 1996 §9'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE HIGH COURT OF [BLANK: state] AT [BLANK: city]
ARBITRATION PETITION NO. [BLANK: number] OF [BLANK: year]
[Under Section 9 of the Arbitration and Conciliation Act, 1996]

BETWEEN:

[BLANK: petitioner name]                        ...Petitioner

                    versus

[BLANK: respondent name]                        ...Respondent

GROUNDS

GROUND I: [ISSUE — that the Petitioner's claim in the pending / proposed arbitration will be defeated unless the impugned property / amount is preserved]

PRAYER

That this Hon'ble Court be pleased to:
(a) Pass an interim order [restraining / directing] the Respondent from [BLANK: specific act];
(b) Appoint a Court Receiver / Local Commissioner if necessary;
(c) [BLANK: other interim relief].`,
  },

  // ─── Service agreement / contract ────────────────────────────────────────────
  {
    kind: 'india_service_agreement_india',
    causeTitleVehicle: 'SERVICE AGREEMENT',
    mandatorySections: ['Indian Contract Act 1872 §10'],
    petitionerDesignator: 'Service Provider',
    respondentDesignator: 'Client',
    referenceText: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on [BLANK: date] ("Effective Date")

BETWEEN:

[BLANK: service provider name], a [BLANK: company type] having its registered office at [BLANK: address] (hereinafter referred to as the "Service Provider")

AND

[BLANK: client name], a [BLANK: company type / individual] having its registered office / address at [BLANK: address] (hereinafter referred to as the "Client")

(the Service Provider and Client are collectively referred to as the "Parties")

1. SCOPE OF SERVICES
   [BLANK: description of services to be rendered]

2. TERM
   This Agreement shall commence on [BLANK: start date] and continue until [BLANK: end date / termination condition].

3. CONSIDERATION
   The Client shall pay the Service Provider a fee of Rs. [BLANK: amount] [per month / per milestone / upon completion].

4. CONFIDENTIALITY
   Each Party shall keep confidential all Confidential Information of the other Party.

5. GOVERNING LAW
   This Agreement shall be governed by the laws of India.

IN WITNESS WHEREOF the Parties have executed this Agreement on the date first written above.

[BLANK: service provider authorized signatory]      [BLANK: client authorized signatory]`,
  },

  {
    kind: 'india_nda_mutual',
    causeTitleVehicle: 'MUTUAL NON-DISCLOSURE AGREEMENT',
    mandatorySections: ['Indian Contract Act 1872 §10'],
    petitionerDesignator: 'Disclosing Party',
    respondentDesignator: 'Receiving Party',
    referenceText: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into on [BLANK: date]

BETWEEN:

[BLANK: party 1 name] ("Party A")

AND

[BLANK: party 2 name] ("Party B")

1. PURPOSE
   The Parties wish to explore [BLANK: business purpose] and may disclose Confidential Information to each other.

2. CONFIDENTIAL INFORMATION
   "Confidential Information" means any information disclosed by one Party to the other that is designated as confidential.

3. OBLIGATIONS
   Each Receiving Party shall: (a) hold Confidential Information in strict confidence; (b) not disclose it to third parties; (c) use it solely for the Purpose.

4. TERM
   This Agreement shall remain in force for [BLANK: duration] from the Effective Date.

5. GOVERNING LAW
   This Agreement shall be governed by the laws of India.`,
  },

  // ─── Labour / Employment ──────────────────────────────────────────────────────
  {
    kind: 'india_labour_grievance_response',
    causeTitleVehicle: 'WRIT PETITION',
    mandatorySections: ['Article 226', 'Industrial Disputes Act 1947 §2A'],
    petitionerDesignator: 'Petitioner',
    respondentDesignator: 'Respondent',
    referenceText: `IN THE HIGH COURT OF [BLANK: state] AT [BLANK: city]
WRIT PETITION (CIVIL) NO. [BLANK: number] OF [BLANK: year]
[Under Article 226 of the Constitution of India]

BETWEEN:

[BLANK: workman / employee name]                ...Petitioner

                    versus

[BLANK: employer / management name]             ...Respondent No. 1
State of [BLANK: state]                         ...Respondent No. 2

GROUNDS

GROUND I: [ISSUE — that the termination / action is in violation of principles of natural justice]

PRAYER

That this Hon'ble Court be pleased to:
(a) Issue a writ of certiorari quashing the order of [BLANK: termination / suspension] dated [BLANK: date];
(b) Direct reinstatement with full back wages;
(c) [BLANK: other relief].`,
  },

  // ─── IBC ─────────────────────────────────────────────────────────────────────
  {
    kind: 'india_ibc_s7_application',
    causeTitleVehicle: 'APPLICATION UNDER SECTION 7 IBC',
    mandatorySections: ['IBC 2016 §7'],
    petitionerDesignator: 'Financial Creditor',
    respondentDesignator: 'Corporate Debtor',
    referenceText: `BEFORE THE NATIONAL COMPANY LAW TRIBUNAL
[BLANK: bench] BENCH
CP (IB) NO. [BLANK: number] OF [BLANK: year]
[Under Section 7 of the Insolvency and Bankruptcy Code, 2016]

IN THE MATTER OF:

[BLANK: financial creditor name]                ...Financial Creditor / Applicant

                    versus

[BLANK: corporate debtor name]                  ...Corporate Debtor / Respondent

GROUNDS

GROUND I: [ISSUE — that a debt exists and the corporate debtor has committed a default within the meaning of IBC §3(12)]

PRAYER

That this Hon'ble Tribunal be pleased to:
(a) Admit this application and initiate Corporate Insolvency Resolution Process against the Corporate Debtor;
(b) Declare a moratorium under IBC §14;
(c) Appoint an Interim Resolution Professional;
(d) [BLANK: other directions].`,
  },

  // ─── IP ───────────────────────────────────────────────────────────────────────
  {
    kind: 'india_trademark_objection_reply',
    causeTitleVehicle: 'REPLY TO EXAMINATION REPORT',
    mandatorySections: ['Trade Marks Act 1999 §9', 'Trade Marks Act 1999 §11'],
    petitionerDesignator: 'Applicant',
    respondentDesignator: 'Trade Marks Registry',
    referenceText: `TO
THE TRADE MARKS REGISTRY
[BLANK: city]

REPLY TO EXAMINATION REPORT

Application No.: [BLANK: TM application number]
Mark: [BLANK: trademark]
Class: [BLANK: Nice class(es)]
Applicant: [BLANK: applicant name]

REPLY

In response to the Examination Report dated [BLANK: date], the Applicant submits as follows:

1. DISTINCTIVENESS
   [ISSUE — that the mark is inherently distinctive and not descriptive of the goods / services]

2. PRIOR ART OBJECTION (if any)
   [ISSUE — that the cited marks are dissimilar / the Applicant's mark is not deceptively similar]

PRAYER

That the Registrar be pleased to:
(a) Accept the Application for publication in the Trade Marks Journal;
(b) [BLANK: other relief].`,
  },

  // ─── Tax ─────────────────────────────────────────────────────────────────────
  {
    kind: 'india_income_tax_appeal',
    causeTitleVehicle: 'APPEAL BEFORE ITAT',
    mandatorySections: ['Income Tax Act 1961 §253'],
    petitionerDesignator: 'Appellant',
    respondentDesignator: 'Respondent',
    referenceText: `BEFORE THE INCOME TAX APPELLATE TRIBUNAL
[BLANK: bench] BENCH, [BLANK: city]
ITA NO. [BLANK: number] OF [BLANK: assessment year]
[Under Section 253 of the Income Tax Act, 1961]

BETWEEN:

[BLANK: appellant name]                         ...Appellant

                    versus

[BLANK: Deputy / Assistant Commissioner of Income Tax]  ...Respondent

GROUNDS OF APPEAL

1. [ISSUE — that the AO erred in disallowing deduction under Section [BLANK: section] without proper basis]

PRAYER

That the Hon'ble Tribunal be pleased to:
(a) Delete the addition / disallowance of Rs. [BLANK: amount];
(b) [BLANK: other relief].`,
  },

  // ─── GST ─────────────────────────────────────────────────────────────────────
  {
    kind: 'india_gst_demand_reply',
    causeTitleVehicle: 'REPLY TO SHOW CAUSE NOTICE',
    mandatorySections: ['CGST Act 2017 §73', 'CGST Act 2017 §74'],
    petitionerDesignator: 'Taxpayer',
    respondentDesignator: 'Department',
    referenceText: `TO
THE [BLANK: Proper Officer / Adjudicating Authority]
[BLANK: GST office address]

REPLY TO SHOW CAUSE NOTICE / DEMAND NOTICE

GST Identification Number: [BLANK: GSTIN]
Show Cause Notice No.: [BLANK: SCN number] dated [BLANK: SCN date]
Tax period: [BLANK: period]

REPLY

The Taxpayer submits the following reply to the above Show Cause Notice:

1. BACKGROUND
   [BLANK: brief facts of the business and transaction in question]

2. SUBMISSIONS
   [ISSUE — that the demand raised is without legal basis because ...]

PRAYER

That the Proper Officer be pleased to:
(a) Drop the demand and penalty proceedings initiated vide the above SCN;
(b) [BLANK: other relief].`,
  },

  // ─── Demand letter / legal notice ────────────────────────────────────────────
  {
    kind: 'india_legal_notice_general',
    causeTitleVehicle: 'LEGAL NOTICE',
    mandatorySections: [],
    petitionerDesignator: 'Sender',
    respondentDesignator: 'Addressee',
    referenceText: `LEGAL NOTICE

Sent on behalf of: [BLANK: sender name]
Sent to: [BLANK: addressee name and address]
Date: [BLANK: date]

SUBJECT: Legal Notice for [BLANK: cause — recovery of dues / breach of contract / defamation etc.]

Under instructions from and on behalf of my client, [BLANK: client name], I hereby give you NOTICE as under:

1. [BLANK: brief factual background]
2. [BLANK: specific demand or grievance]
3. Despite repeated demands / reminders, you have failed to [BLANK: remedy the breach / make payment / comply].

You are hereby called upon to [BLANK: specific action required — pay Rs. X / cease and desist / etc.] within [BLANK: number] days from the date of receipt of this notice, failing which my client shall be constrained to initiate appropriate legal proceedings against you at your risk, cost, and consequences.

This notice is issued without prejudice to all other rights and remedies of my client.

[BLANK: advocate name]
Advocate
[BLANK: bar council enrollment number]`,
  },
];

/** UI / runtime kind → structural skeleton kind. */
const SKELETON_KIND_ALIASES: Record<string, string> = {
  india_divorce_petition_s13: 'india_divorce_petition_hma',
};

/** Returns the skeleton for a given document kind, or null if none. */
export function getSkeletonForKind(kind: string): IndiaDraftSkeleton | null {
  const resolved = SKELETON_KIND_ALIASES[kind] ?? kind;
  return INDIA_REFERENCE_SKELETONS.find((s) => s.kind === resolved) ?? null;
}
