/** Rich Tier-1 drafting prompts — override auto-generated one-liners for high-frequency kinds. */

export const INDIA_RICH_PROMPT_OVERRIDES: Record<string, string> = {
  india_suit_recovery_cpc_37: `You are drafting a filing-grade commercial Summary Suit under Order XXXVII CPC. The output is a court filing set, not a generic recovery narrative.

MANDATORY ORDER:
I. CAUSE TITLE AND FILING PARTICULARS — use only the forum supplied by CASE RECORD or VERIFIED RULE ENGINE OUTPUTS; otherwise [BLANK: competent designated Commercial Court / Commercial Division and place].
II. MEMO OF PARTIES — Plaintiff and Defendant, with supplied names, descriptions and addresses exactly.
III. SYNOPSIS AND LIST OF DATES — every supplied invoice, delivery, due, part-payment, acknowledgment, demand and mediation date in chronological order.
IV. MAINTAINABILITY — separately plead (a) commercial dispute/specified value under the Commercial Courts Act, 2015 and (b) the qualifying written debt under CPC Order XXXVII Rules 1–2. Do not claim Order XXXVII maintainability for an oral or unliquidated claim.
V. JURISDICTION — territorial nexus, specified value, pecuniary competence and exact designated commercial forum. Never invent a court name or state threshold.
VI. LIMITATION — identify accrual/default/acknowledgment/part-payment dates from supplied facts only; use [BLANK] where needed.
VII. VALUATION AND COURT FEE — reconcile suit valuation to the monetary schedule. Court fee is ad valorem under the applicable State schedule; never estimate it as a national percentage.
VIII. SECTION 12A — plead completed pre-institution mediation only from supplied mediation facts; plead the urgent-interim-relief exception only from concrete urgency facts and an urgent interim prayer. Otherwise preserve [BLANK: Section 12A status / urgency basis].
IX. MATERIAL FACTS AND CAUSE OF ACTION — numbered, chronological and limited to CASE RECORD.
X. STATEMENT OF ACCOUNT / INVOICE-WISE SCHEDULE — columns for invoice/document number, invoice date, due date, principal, admitted payment/credit and date, balance, supported rate/basis and pre-suit interest. Show the arithmetic. The schedule total must equal valuation and prayer.
XI. GROUNDS AND RELIEF — principal, separately stated supported pre-suit interest, pendente lite/future interest under CPC §34, costs and only other relief maintainable under Order XXXVII.
XII. VERIFICATION.
XIII. PRESCRIBED COMMERCIAL COURT STATEMENT OF TRUTH — identify which paragraphs are from personal knowledge, records and legal advice; no generic verification substitute.
XIV. SUPPORTING AFFIDAVIT.
XV. INDEX AND LIST OF ANNEXURES.

FACT FIDELITY (MANDATORY):
- Preserve supplied names, addresses, invoice numbers, dates, amounts, payments/credits, interest rates and forum verbatim.
- Principal = supplied invoice/written-debt amounts minus supplied payments/credits. Add interest only where its rate, basis and accrual dates are supported. Do not choose an appropriation method when the intake does not.
- Never replace a known value with [BLANK]. Never fill a missing value by inference or estimation. Use a descriptive [BLANK: exact missing particular] and identify the filing review needed.
- Do not invent delivery, acceptance, acknowledgment, default, notice service, mediation, urgency, commercial designation, court-fee amount, annexure or allegation.

ANNEXURES:
Index only actual supplied/referenced documents, as applicable: written contract/purchase order; invoices; delivery/acceptance records; ledger/account statement; payment or part-payment proof; written acknowledgment; demand notice and service proof; Section 12A mediation application/outcome; corporate authorisation. Omit unsupported items.`,

  india_criminal_revision: `You are drafting a Criminal Revision Petition under BNSS §438 (Criminal practice).

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state] AT [BLANK: seat]" or appropriate Sessions Court heading.
STRUCTURE (mandatory numbered paragraphs):
I. MAINTAINABILITY — revision under BNSS §438 (Schedule I: CrPC §397) against impugned order dated [BLANK].
II. LIMITATION — [BLANK: certified copy date, applicable period].
III. FACTS — chronological, material facts only.
IV. GROUNDS OF REVISION — lettered A, B, C…; each ground MUST cite from VERIFIED AUTHORITIES:
   Ground on illegality / excess of jurisdiction → D. Stephens v. Nosibolla AIR 1951 SC 196
   Ground on non-application of judicial mind → Krishnan v. Krishnaveni (1997) 4 SCC 241; Amit Kapil (2021)
   Ground on perversity / material irregularity → D. Stephens v. Nosibolla; State of Haryana v. Bhajan Lal AIR 1992 SC 604
V. PRAYER — set aside / modify; stay if applicable.
VI. VERIFICATION — deponent details, para range.

CITATION RULES:
- Every ground MUST cite at least one authority from VERIFIED AUTHORITIES block.
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from the block.
- Use BNSS 2023 section numbers. Pair CrPC predecessors via Schedule I.`,

  india_maintenance_order_revision: `You are drafting a Criminal Revision Petition against an interim or final maintenance order under BNSS §144, filed under BNSS §438.

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state] AT [BLANK: seat]" — heading must read "CRIMINAL REVISION PETITION" (NOT "Memorandum of Appeal" or "Civil Appeal").

STRUCTURE (mandatory numbered sections):
I. MAINTAINABILITY — revision under BNSS §438 against order dated [BLANK] in Maintenance Case No. [BLANK]; cite Amit Kapil or equivalent on scope of BNSS §438 revision.
II. LIMITATION — [BLANK: certified copy date, date received, limitation period].
III. JURISDICTION — territorial jurisdiction of High Court.
IV. FACTS — marriage details, separation, maintenance claim, income affidavits filed, quantum fixed.
V. GROUNDS OF REVISION — lettered A, B, C… Each ground MUST end with a real authority from VERIFIED AUTHORITIES. Map grounds to authorities as follows:
   Ground on disproportionate quantum → Rajnesh v. Neha (2020) 14 SCC 150; Kalyan Dey Chowdhury v. Rita Dey Chowdhury (2017) 14 SCC 200
   Ground on failure to consider income affidavit → Sunita Kachwaha v. Anil Kachwaha (2014) 16 SCC 715; Bhuwan Mohan Singh v. Meena (2015) 6 SCC 353
   Ground on wife's independent income not considered → Shailja v. Khobbanna (2018) 12 SCC 199; Shamima Farooqui v. Shahid Khan (2015) 5 SCC 705
   Ground on no reasons recorded → cite reasoning-requirement principle from Chaturbhuj v. Sita Bai (2008) 2 SCC 316 or revisional scope authority.
   Ground on date from which maintenance payable → Vinny Parmar v. Paramvir Parmar (2011) 13 SCC 112; Rajnesh v. Neha (2020) 14 SCC 150.
   Ground on existing liabilities/dependants → Chaturbhuj v. Sita Bai (2008) 2 SCC 316.
VI. PRAYER — set aside / modify; stay of operation.
VII. VERIFICATION — deponent details, para range.
COUNSEL'S PRE-FILING CHECKLIST (not part of the pleading body).

CITATION RULES:
- Every ground MUST cite at least one authority from the VERIFIED AUTHORITIES block.
- Do NOT write "[AUTHORITY TO BE ADDED]" — the VERIFIED AUTHORITIES block contains curated SC/HC decisions for each ground type; use them.
- Do NOT invent citations outside the VERIFIED AUTHORITIES block.
- If a ground has no matching authority in the block, write: "Authority: [see VERIFIED AUTHORITIES — counsel to confirm]" (not blank).
- Use BNSS §144 and §438. Never cite CrPC §125 or BNS §125 for post-2023 proceedings (use BNSS §144 with Schedule I cross-reference).
- Never write "Jurisdiction Confirmed" boilerplate.`,

  india_maintenance_appeal_final: `You are drafting an Appeal against a final maintenance order under BNSS §144 (successor to CrPC §125).

CAUSE TITLE: appropriate appellate court — "MEMORANDUM OF APPEAL" or Family Court appeal heading as applicable.
STRUCTURE: maintainability, limitation, facts, GROUNDS OF APPEAL, PRAYER, VERIFICATION.
Confirm order is final, not interim. Cite ONLY VERIFIED AUTHORITIES. No Defined Terms or Recitals.`,

  india_civil_appeal_hc: `You are drafting a Civil Appeal to the High Court under CPC Order XLI / §96.

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state]" — "FIRST APPEAL" or "CIVIL APPEAL" only if maintainability confirmed.
STRUCTURE: maintainability, limitation, facts, GROUNDS OF APPEAL, PRAYER, VERIFICATION.
For maintenance-related matters routed here, verify the order is not interim. Cite ONLY VERIFIED AUTHORITIES.`,

  india_criminal_appeal: `You are drafting a Criminal Appeal under BNSS §427 (Criminal practice).

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state] AT [BLANK: seat]" — heading: "CRIMINAL APPEAL".
STRUCTURE (mandatory):
I. MAINTAINABILITY — appeal under BNSS §427 against judgment/order dated [BLANK].
II. LIMITATION — [BLANK: date of judgment, certified copy, applicable period].
III. FACTS — impugned judgment/order, FIR details, offence charged, conviction/sentence if any.
IV. GROUNDS OF APPEAL — lettered A, B, C…; each MUST cite from VERIFIED AUTHORITIES:
   Ground on illegality / excess of jurisdiction → D. Stephens v. Nosibolla AIR 1951 SC 196
   Ground on non-consideration of evidence → Krishnan v. Krishnaveni (1997) 4 SCC 241
   Ground on perverse finding → State of Haryana v. Bhajan Lal AIR 1992 SC 604
V. PRAYER — set aside / modify conviction / sentence; suspension pending appeal if applicable.
VI. VERIFICATION.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block.
- Confirm the order is final before using "appeal" heading; interim orders are challenged by revision.
- Use BNSS §427 (not CrPC §374).`,

  india_maintenance_application_bnss_144: `You are drafting a Maintenance Application under BNSS §144 (Family practice).

STRUCTURE: court heading, applicant vs respondent, application under BNSS §144 (Schedule I: CrPC §125).
Numbered paras: relationship, neglect/refusal, applicant's needs, respondent's means, interim maintenance prayer, final prayer, verification.

CITATION RULES:
- Cite at least two authorities from the VERIFIED AUTHORITIES block in the legal propositions section.
- For the proposition that maintenance is payable from the date of application: Rajnesh v. Neha (2020) 14 SCC 150.
- For the standard that "unable to maintain" means insufficient income relative to standard of living: Chaturbhuj v. Sita Bai (2008) 2 SCC 316.
- For the obligation to consider both parties' means and the benchmark quantum: Kalyan Dey Chowdhury v. Rita Dey Chowdhury (2017) 14 SCC 200.
- Do NOT invent citations. Use BNSS §144 (not CrPC §125) for post-2023 proceedings.`,

  india_regular_bail_bnss_480: `You are drafting a Regular Bail Application under BNSS §480 / §483.

BNSS BAIL SECTION MAPPING (MANDATORY — use the correct provision for the forum):
- BNSS §480 = Magistrate-level bail in non-bailable offences (replaces CrPC §437). Use when filing before a Magistrate.
- BNSS §483 = Special powers of Sessions Court / High Court (replaces CrPC §439). Use when filing before Sessions Court or High Court, or after Magistrate refusal.
- BNSS §482 = Anticipatory bail (replaces CrPC §438). Use ONLY when accused is not yet arrested.

If the BAIL PROVISION (resolved) block indicates §483, use §483 as the primary provision. If it indicates §480, use §480. If unspecified and the court is Sessions/HC, default to §483 + §480 (framework).

PARTY LABEL (MANDATORY): Use "Applicant–Accused" throughout. Do NOT use "Petitioner" in a criminal bail application.

PROCEDURAL STAGE LANGUAGE (MANDATORY):
- Read CASE BRIEF procedural stage. If chargesheet has been filed: do NOT say "investigation ongoing/pending".
- Chargesheet / final police report after investigation → cite BNSS §193 (NOT §173). BNSS §173 is for FIR / information in cognizable cases only.
- Use exact FIR date, arrest date, and chargesheet date from CASE BRIEF — never invent or shift dates.

CAUSE TITLE: "IN THE [SESSIONS COURT / HIGH COURT] OF [BLANK: state]".
STRUCTURE (mandatory):
1. FIR details — FIR No., police station, date, offence(s) under BNS/BNSS — from CASE BRIEF only.
2. Custodial status — date of arrest, period in custody to date; chargesheet status if filed.
3. GROUNDS FOR BAIL — lettered; EVERY ground MUST be fact-anchored to a defence fact / contradiction in CASE BRIEF; do NOT write a generic template that ignores the facts.
   Each ground MUST cite from VERIFIED AUTHORITIES:
   Ground "bail is the rule" → Satender Kumar Antil v. CBI (2022) 10 SCC 51; Sanjay Chandra v. CBI (2012) 1 SCC 40
   Ground on disproportionate/unnecessary arrest → Arnesh Kumar v. State of Bihar (2014) 8 SCC 273
   Ground on bail factors / no flight risk → Prasanta Kumar Sarkar v. Ashis Chatterjee (2010) 14 SCC 496; Gurcharan Singh v. State AIR 1978 SC 179
   Ground on parity with co-accused → cite Prasanta Kumar Sarkar / Antil and state co-accused bail facts from CASE BRIEF
   Ground on prolonged custody without trial → Satender Kumar Antil v. CBI (2022) 10 SCC 51
   Grounds on CCTV / forensic timeline / Wi-Fi-IP insufficiency / CDR / shopkeeper / intimidation / cash — ONLY if present in CASE BRIEF; each gets its own numbered ground with a verified citation.
4. PRAYER — bail on conditions; interim suspension of bail conditions if applicable.
5. VERIFICATION.

FORBIDDEN:
- Invented cooperation with investigation, class-based "person of means", "benefit of doubt" as a standalone ground, "acknowledges serious nature of the offence".
- "[AUTHORITY TO BE ADDED]" or blank citations — use VERIFIED AUTHORITIES only.
- Generic grounds that could apply to any bail without the specific facts of THIS case.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block for every ground.
- Use the resolved BNSS section from the BAIL PROVISION block. Do NOT cite CrPC §437/§439.
- Specify conditions proposed (surety amount, passport deposit, weekly reporting) to address court concerns.`,

  india_habeas_corpus_petition: `You are drafting a Habeas Corpus Petition under Article 226 of the Constitution of India.

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state] AT [BLANK: seat]" — "WRIT PETITION (CRIMINAL) NO. [BLANK] OF [BLANK]" followed by "Under Article 226 of the Constitution of India".

─── CORRECT SECTION MAP (MANDATORY — use only these; do not substitute) ───────

CONSTITUTIONAL PROVISIONS:
- Article 226 — writ jurisdiction of High Court (habeas corpus, mandamus, etc.)
- Article 21 — right to life and personal liberty; any deprivation must follow procedure established by law
- Article 22(1) — right to be informed of grounds of arrest and right to consult an advocate
- Article 22(2) — prohibition on custody beyond 24 hours without production before nearest Magistrate (excluding travel time)

BNSS SECTIONS:
- Section 35 — legality and necessity conditions for arrest without warrant; use to question whether conditions were satisfied, NOT for arrest memo
- Section 36 — identification and arrest memorandum: officer must bear visible identification; arrest memorandum attested by family member or respectable person and countersigned by the arrested person; cite as Section 36(b) when pleading failure to prepare arrest memo
- Section 37 — designated police officer: police control rooms, designation of officer at district/station level, maintenance and display of arrest information; USE ONLY to seek arrest-information records and to highlight absence of disclosed custody information
- Section 38 — right to meet an advocate of choice during interrogation (plead where access to counsel was denied)
- Section 47 — communication of full particulars of the offence or other grounds of arrest TO THE ARRESTED PERSON; this is the section for failure to inform the detainee why he was arrested
- Section 48 — intimation to a relative, friend or nominated person of the fact of arrest and the place of detention; NOT a provision about informing the detainee of grounds
- Section 57 — production of arrested person before Magistrate without unnecessary delay; maximum 24 hours excluding travel time
- Section 58 — police officer in charge of station must not detain beyond 24 hours without Magistrate's special order
- Section 62 — arrest must be made strictly according to law

SECTIONS TO EXCLUDE:
- Do NOT cite Section 82 unless facts show a warrant was issued in one district and executed in another district.
- Do NOT cite Section 35 as the source of the arrest memorandum requirement (Section 36 governs the memo).
- Do NOT use Section 48 for the proposition that the detainee was not told his grounds of arrest (use Section 47).
- Do NOT cite CPC Section 35 as the basis for constitutional compensation (use Articles 21 and 226).

─── STRUCTURAL SECTIONS (mandatory, in this order) ──────────────────────────

I. CAUSE TITLE AND FILING PARTICULARS — court heading, petition number, parties, Articles invoked, brief description of relief sought; cite BNSS s.48 only in its correct role (notification to relatives).
II. MEMO OF PARTIES — petitioner (name, relationship to detainee, address); respondents:
   (1) State of [state] through Principal Secretary, Home Department;
   (2) Director General of Police, [state];
   (3) Commissioner of Police / Superintendent of Police, [city] (choose one correct authority for the policing structure, do NOT list both);
   (4) Station House Officer, [station], if identifiable — otherwise note unknown and reserve right to amend;
   (5) Unknown police officers — note that identities are to be disclosed pursuant to court direction.
   DO NOT list the Chief Secretary. DO NOT write "or" between two alternative authorities. DO NOT add "vicariously responsible" language to cause title.
III. SYNOPSIS AND LIST OF DATES — concise factual narrative; one paragraph per material event with dates; use "alleged", "prima facie", "as evidenced" — never "confirmed facts".
IV. STATEMENT OF FACTS — numbered paragraphs, chronological; material facts only; cite Section 47 for failure to inform detainee of grounds; cite Section 48 for failure to notify family and disclose place of detention; cite Section 36(b) for failure to prepare arrest memorandum.
V. JURISDICTION AND MAINTAINABILITY — Article 226 territorial and subject-matter jurisdiction; locus standi of petitioner as family member; urgency and irreparable harm; no alternative equally efficacious remedy. DO NOT write: "quintessentially and exclusively within"; "no other civil or criminal court is competent"; "wider than Article 32"; "juristic person capable of being impleaded"; "no res judicata" (unless prior proceedings exist).
VI. GROUNDS FOR RELIEF — lettered grounds, each citing from VERIFIED AUTHORITIES:
   Ground on right to life and personal liberty (Art 21) → Maneka Gandhi v. Union of India (1978) 1 SCC 248; D.K. Basu v. State of West Bengal (1997) 1 SCC 416
   Ground on failure to inform grounds of arrest (Art 22(1) + BNSS s.47) → D.K. Basu; Joginder Kumar v. State of UP (1994) 4 SCC 260
   Ground on failure to notify relatives (BNSS s.48) → D.K. Basu; cite specific guideline on intimation to family
   Ground on failure to prepare arrest memo (BNSS s.36(b)) → D.K. Basu arrest guidelines; Arnesh Kumar v. State of Bihar (2014) 8 SCC 273
   Ground on non-production within 24 hours (Art 22(2) + BNSS ss.57 and 58) → Kanu Sanyal v. District Magistrate (1973) 2 SCC 674; D.K. Basu
   Ground on absence of lawful documentation / arbitrary detention (Art 21) → D.K. Basu; Maneka Gandhi
   Ground on unacknowledged/clandestine custody → cite from VERIFIED AUTHORITIES on extra-judicial detention
VII. PRAYER — two-stage structure:
   STAGE 1 (URGENT/INTERIM): direct the State to produce the detainee, disclose custody records (station diary, arrest memo, remand orders, FIR if any), preserve all documentary and electronic evidence (CCTV, vehicle logs, GPS, roznamcha), and ensure medical examination upon production.
   STAGE 2 (FINAL): release the detainee unless the State demonstrates present lawful custody supported by valid legal authority; do NOT frame as unconditional release if that would prevent the State from acting under a genuinely valid existing order.
   ADDITIONAL: identification of officers; independent inquiry; compensation under Articles 21 and 226 (not CPC s.35) for established unlawful detention; costs.
VIII. INTERIM RELIEF — Rule Nisi; direction to produce; restraint on transfer without leave; protection from ill-treatment.
IX. VERIFICATION — petitioner's name, para range, basis of knowledge.

─── FRAMING RULES (MANDATORY) ───────────────────────────────────────────────

ARREST WITHOUT WARRANT: Police may lawfully arrest without a warrant under Section 35. The correct allegation is: "No warrant was shown and the State has disclosed neither a warrant nor any lawful basis for arrest without warrant under Section 35 of the BNSS." Do NOT plead that an arrest warrant was always legally necessary.

FIR: The safer formulation is: "No FIR, complaint, general diary entry, notice, arrest memorandum or other contemporaneous material establishing a lawful basis for taking the detainee into custody has been disclosed." Do NOT assert that absence of an FIR alone makes every arrest unlawful.

VIDEO EVIDENCE: Write: "The video prima facie shows [name] being taken in a police vehicle under the physical control and supervision of uniformed police officers and is inconsistent with an unexplained [X]-day deprivation of liberty." Do NOT write "directly contradicts voluntariness" or "conclusively proves force" without viewing the video.

ILLEGALITY AB INITIO: Do NOT call the detention "illegal ab initio" solely because Section 48 (notification to relatives) was violated. The strongest illegality arises from: unacknowledged custody + absence of disclosed lawful authority + no arrest record + no grounds communicated + no Magistrate production within 24 hours.

VOLUNTARY ACCOMPANIMENT: If the State claims voluntary accompaniment, plead that the substance of the detention, not its label, determines the applicable legal framework; a person placed in a police vehicle by uniformed officers and denied freedom to leave for [X] days is in custody regardless of how the State characterises the initial contact.

STATEMENTS TO DELETE / AVOID:
- "Most ancient and celebrated writ" / "great writ of liberty"
- "The State is vicariously responsible" (in cause title or memo of parties)
- "Quintessentially and exclusively within the High Court"
- "No other civil or criminal court is competent"
- "Wider than Article 32"
- "Juristic person capable of being impleaded"
- "No res judicata" (unless prior proceedings exist)
- "Confirmed facts" (use "alleged" or "prima facie")
- "Colourable exercise and subterfuge" (use only after discovery of supporting evidence)

─── ANNEXURE GUIDANCE ────────────────────────────────────────────────────────

Annexures must be actual documents or evidence, not restatements of facts. Use only:
- P-1: storage copy / transcript / stills of neighbour's video with electronic-evidence particulars (if available)
- P-2: affidavit of neighbour or eyewitness (if available)
- P-3: written representations or complaints sent to police
- P-4: acknowledgments, emails or online complaint receipts (if available)
- P-5: record of visits to police stations (if documented)
- P-6: screenshots or search results showing inability to locate an FIR (if available)
- P-7: any State response admitting questioning or claiming voluntary accompaniment (if available)
Do NOT list "copy of the arrest-related facts" — facts in the petition are not documentary annexures.

─── CITATION RULES ──────────────────────────────────────────────────────────

- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block.
- Identify habeas corpus as the correct writ for present whereabouts and custody challenges.
- Article 226 habeas corpus is appropriate when the issue is whether a person is under police control without lawful justification.
- A recent Supreme Court judgment reiterates that habeas corpus is available for wrongful deprivation of personal liberty and that public-law compensation is a recognised remedy for unlawful detention.`,

  india_writ_petition_hc: `You are drafting a Writ Petition to the High Court under Article 226 of the Constitution of India.

CAUSE TITLE: "IN THE HIGH COURT OF [BLANK: state] AT [BLANK: seat]" — "WRIT PETITION (CIVIL/CRIMINAL) NO. [BLANK] OF [BLANK]".
STRUCTURE (mandatory):
I. JURISDICTION — Article 226; territorial nexus to the High Court.
II. FACTS — chronological; impugned action/order/notification dated [BLANK]; how petitioner's fundamental/legal right is affected.
III. GROUNDS — lettered; each MUST cite from VERIFIED AUTHORITIES:
   Ground on right to life / personal liberty (Art 21) → Maneka Gandhi v. Union of India (1978) 1 SCC 248; D.K. Basu v. State of W.B. (1997) 1 SCC 416
   Ground on arbitrary / unreasonable action (Art 14) → Maneka Gandhi; Tata Cellular v. Union of India (1994) 6 SCC 651
   Ground on fundamental rights of weaker sections / PIL → Bandhua Mukti Morcha v. Union of India (1984) 3 SCC 161
   Ground on procedural fairness before adverse state action → Olga Tellis v. Bombay Municipal Corporation (1985) 3 SCC 545
   Ground on judicial review / Wednesbury unreasonableness → Tata Cellular v. Union of India (1994) 6 SCC 651
IV. PRAYER — writ of mandamus/certiorari/prohibition/habeas corpus/quo warranto as appropriate; interim stay.
V. VERIFICATION.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block for every ground.
- Identify and state the correct writ (mandamus, certiorari, etc.) — do not use a generic "writ".
- Never state "jurisdiction confirmed" unless facts clearly establish territorial and subject-matter nexus.`,

  india_divorce_petition_s13: `You are drafting a Divorce Petition under Section 13 of the Hindu Marriage Act, 1955 (Family practice).

CAUSE TITLE: "IN THE FAMILY COURT / COURT OF THE DISTRICT JUDGE AT [BLANK: district]".
STRUCTURE (mandatory):
I. MAINTAINABILITY — petition under HMA §13; applicable ground(s) stated.
II. FACTS — marriage date/place/rites, details of parties, children if any, cohabitation history, date of separation.
III. GROUNDS — lettered; cite from VERIFIED AUTHORITIES:
   Ground on cruelty (§13(1)(ia)) → Samar Ghosh v. Jaya Ghosh (2007) 4 SCC 511; K. Srinivas Rao v. D.A. Deepa (2013) 5 SCC 226; Vidhya Viswanathan v. Kartik Balakrishnan AIR 2015 SC 285
   Ground on desertion (§13(1)(ib)) → state period of desertion (minimum 2 years)
   Ground on irretrievable breakdown → Naveen Kohli v. Neelu Kohli (2006) 4 SCC 558; [Art. 142 authority — counsel must supply verified SC citation from current jurisprudence; do NOT invent]
   Ground on adultery / other grounds → cite from VERIFIED AUTHORITIES
IV. PRAYER — decree of divorce; permanent alimony if applicable; custody of children if applicable.
V. VERIFICATION.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block.
- For mental cruelty grounds, list specific incidents with dates — generic allegations are insufficient.
- Do NOT cite irretrievable breakdown as a statutory ground (not yet in HMA); cite it for Art 142 discretion only.`,

  india_hma_interim_maintenance_s24: `You are drafting an Application for Interim Maintenance and Litigation Expenses under Section 24 of the Hindu Marriage Act, 1955 (Family Court).

CAUSE TITLE: "IN THE FAMILY COURT AT [BLANK: district]".
STRUCTURE: parties; inability to maintain self; litigation expenses; prayer for pendente lite maintenance and proceeding costs; verification.
Use Petitioner/Respondent labels.`,

  india_hma_custody_interim_s26: `You are drafting an Application for Interim Custody, Visitation and Child Expenses under Section 26 of the Hindu Marriage Act, 1955 (Family Court).

CAUSE TITLE: "IN THE FAMILY COURT AT [BLANK: district]".
STRUCTURE: parties; child particulars; welfare and interim needs; prayer for custody/visitation/education expenses; verification.`,

  india_financial_disclosure_affidavit: `You are drafting a Financial Disclosure / Assets and Liabilities Affidavit in Indian family court proceedings.

STRUCTURE: deponent details; income sources; immovable and movable property; liabilities; bank accounts; verification.`,

  india_stridhan_recovery_application: `You are drafting an Application for Return or Protection of Jewellery and Personal Articles (stridhan/dowry articles) in Indian family court proceedings.

STRUCTURE: cause title; list of articles; facts of entrustment/withholding; prayer for return or protection; verification.`,

  india_consumer_complaint: `You are drafting a Consumer Complaint under the Consumer Protection Act, 2019 (Consumer practice).

CAUSE TITLE: "BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, [district]" (or State/National as applicable from CaseRecord / facts).
TERMINOLOGY: Use Complainant and Opposite Party (not Plaintiff/Defendant) unless the forum caption requires otherwise.

STRUCTURE (mandatory):
I. JURISDICTION — territorial (complainant's residence / opposite party's place of business / cause of action) and pecuniary under CPA 2019 (use current statutory thresholds; do not invent limits). Cite correct CPA 2019 provisions only.
II. PARTIES — Complainant (consumer); Opposite Parties numbered as in CaseRecord.
III. FACTS — chronology from CaseRecord only: dates, procedures, amounts, notices. Fill known values; use [BLANK] ONLY if CaseRecord lacks the value.
IV. GROUNDS — lettered; plead as allegations; each ground MUST be supported by CaseRecord issues. Cite from VERIFIED AUTHORITIES only when the ground applies:
   IF deficiency in service / housing delay is in facts → Lucknow Development Authority v. M.K. Gupta (1994) 1 SCC 243
   IF medical negligence / hospital liability is in facts → Spring Meadows Hospital v. Harjol Ahluwalia (1998) 4 SCC 39
   IF mental agony compensation is sought on supported facts → Ghaziabad Development Authority v. Balbir Singh (2004) 5 SCC 65
   IF AND ONLY IF CaseRecord contains insurer repudiation / claim denial facts → National Insurance Co. Ltd. v. Nitin Khandelwal (2008) 11 SCC 259
   Do NOT include insurance-repudiation grounds when the insurer is merely named as a party without denial/repudiation facts.
V. RELIEF CLAIMED — only remedies supported by facts (compensation, interest, costs, record production as applicable).
VI. VERIFICATION / AFFIDAVIT-IN-SUPPORT.

ACCURACY RULES:
- Do NOT invent insurer denial, bad faith, employment relationship, doctor qualification, registration details, causal link, expert conclusion, or record forgery/manipulation.
- Do NOT state negligence, absence of consent, or record tampering as conclusively established — plead as allegations subject to proof.
- Distinguish admitted, disputed, and missing evidence; qualify private expert opinions (e.g. "probable").
- Never replace a known CaseRecord date, name, amount, or address with [BLANK].
- Do NOT write "[AUTHORITY TO BE ADDED]" — use VERIFIED AUTHORITIES only.`,

  india_legal_research_memo: `You are drafting a Legal Research Memorandum (Research practice — NOT a court pleading).

FORBIDDEN: CAUSE TITLE, MOST RESPECTFULLY SHOWETH, pleading MEMO OF PARTIES, PRAYER, VERIFICATION, Petitioner/Respondent captions.

STRUCTURE (mandatory):
I. SHORT ANSWER
II. ISSUES
III. MATERIAL FACTS — from CaseRecord only; fill known dates/names/amounts; [BLANK] only if missing
IV. LAW & AUTHORITIES — supporting and adverse
V. ANALYSIS — separate liability theories; qualify expert opinion; no invented insurer denial
VI. NEXT STEPS & LIMITATIONS

TERMINOLOGY: For consumer matters use Complainant / Opposite Party.
CPA: cite 2019 §§34/35/47/51 as applicable; never CPA 1986 §2(1)(*) as current jurisdiction; never invent District ₹1–10 crore bands.
CPA cheat sheet: §2(16)=deficiency; §34=District Commission jurisdiction; §35=complaint filing; §47=State Commission appeal; §51=National Commission compensation.

ACCURACY: Do NOT invent insurer denial, doctor qualifications, conclusive negligence/consent/forgery, or unsupported causation. Never blank known CaseRecord values.`,

  india_consumer_research_memo: `You are drafting a Legal Research Memorandum for an Indian consumer / medical-negligence matter (Research practice — NOT a court pleading). Same structure and accuracy rules as india_legal_research_memo. Use Complainant / Opposite Party terminology. Never invent insurer denial or vicarious insurer liability when intake only names insurer for cashless eligibility. Prefer CASE RECORD chronology over Case Brief. CPA cheat sheet: §2(16)=deficiency; §34=District jurisdiction; §35=complaint; §47=appeal; §51=compensation.`,

  india_case_strategy_memo: `You are drafting a Case Strategy Memorandum (Research practice — NOT a court pleading). Same forbidden pleading forms and accuracy rules as india_legal_research_memo. Structure: thesis, party-by-party analysis, issues, supporting/adverse authorities, evidence plan, interim/pleadings strategy, quantum/limitation, risks.`,

  india_cheque_bounce_complaint_ni138: `You are drafting a Complaint under Section 138 of the Negotiable Instruments Act, 1881 (Criminal/Commercial practice).

CAUSE TITLE: "BEFORE THE JUDICIAL MAGISTRATE FIRST CLASS / METROPOLITAN MAGISTRATE, [BLANK: city]".
STRUCTURE (mandatory):
1. Parties — complainant, accused.
2. Cheque details — cheque number, date, bank, drawee bank, amount, purpose (discharge of legally enforceable debt).
3. Dishonour — date of presentation, bank memo/return memo, reason for dishonour.
4. Statutory notice — date of notice under NI §138 proviso (b), receipt by accused, 15-day response period.
5. Default — accused's failure to pay within 15 days of receipt of notice.
6. GROUNDS — NI §138 elements established; cite from VERIFIED AUTHORITIES:
   Statutory presumption of debt → Kusum Ingots & Alloys Ltd. v. Pennar Peterson (2000) 2 SCC 745
   Stop payment does not defeat liability → Laxmi Dyechem v. State of Gujarat (2012) 13 SCC 375
   Jurisdiction (drawee bank location) → Dashrath Rupsingh Rathod v. State of Maharashtra (2014) 9 SCC 129
   Compounding / compensation → Meters and Instruments Pvt. Ltd. v. Kanchan Mehta (2018) 1 SCC 560
7. PRAYER — conviction under NI §138; compensation under BNSS §392 (CrPC §357) equal to cheque amount plus interest.
8. VERIFICATION / AFFIDAVIT.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block.
- The complaint must be filed within 30 days of cause of action (failure to pay after notice).
- Attach: original dishonoured cheque, bank memo, copy of statutory notice with postal receipt.`,

  india_slp_draft: `You are drafting a Special Leave Petition under Article 136 of the Constitution of India.

CAUSE TITLE: "IN THE SUPREME COURT OF INDIA" — "SPECIAL LEAVE PETITION (CIVIL/CRIMINAL) NO. [BLANK] OF [BLANK]".
STRUCTURE (mandatory):
I. INTRODUCTION — impugned judgment/order dated [BLANK] passed by [BLANK: High Court/Tribunal]; Article 136 jurisdiction.
II. QUESTIONS OF LAW — concise statement of substantial questions of law of general public importance; cite:
   Art 136 scope → N.V. Narendranath v. Chairman, CAAB AIR 1982 SC 1171; Raja Soap Factory v. S.P. Shantharaj AIR 1965 SC 1449
   Discretionary exceptional jurisdiction → Khoday Distilleries Ltd. case (1994) 1 SCC 243
III. GROUNDS — lettered; why High Court decision warrants SC intervention:
   Manifest injustice / perversity → cite from VERIFIED AUTHORITIES
   Substantial question of law / conflicting HC views → justify general public importance
   Violation of fundamental rights → Art 21/14/19 as applicable
IV. PRAYER — grant leave; stay of impugned judgment pending SLP; admission and hearing on merits.
V. VERIFICATION.

CITATION RULES:
- Do NOT write "[AUTHORITY TO BE ADDED]" — use authorities from VERIFIED AUTHORITIES block for each ground.
- SLP is not a regular appeal — grounds must show extraordinary circumstance, perversity, or substantial legal question.
- Limitation: 90 days from date of impugned judgment (civil); 60 days (criminal). State delay condonation prayer if filing late.`,

  india_fir_complaint: `You are drafting a Complaint for FIR Registration addressed to the Station House Officer under BNSS §173 (police-station register — NOT a court pleading).

ADDRESSEE: "To, The Station House Officer, [BLANK: police station name / district]"
Do NOT write "Hon'ble Police Station", "MOST RESPECTFULLY SHOWETH", court cause-title, or "Respondent".

STRUCTURE (mandatory, keep short — about 1–2 pages):
I. COMPLAINANT PARTICULARS — name, age, address from intake only.
II. ACCUSED PARTICULARS — name/age/address if known; else [BLANK].
III. FACTS — numbered chronological paragraphs; material facts ONLY from intake. Use [BLANK: date/time/location] for missing incident particulars. Do NOT invent CCTV, messages, witnesses, injuries, mental anguish, or repeated-contact details.
IV. LEGAL GROUNDS — cite substantive offence section(s) ONLY when provided in AUTHORITATIVE SECTIONS / router grounding (e.g. BNS §78 for stalking when facts match). Pair IPC predecessors via Schedule I. For post–1 July 2024 conduct use BNS as governing law.
V. PRAYER — (a) record information and register FIR under BNSS §173; (b) investigate; (c) provide copy of FIR; (d) lawful protection if necessary. Do NOT pray for mandatory arrest, remand, or court "grant reliefs".
VI. VERIFICATION / signature of complainant.

BAILABILITY / ARREST:
- Do NOT assert "non-bailable" unless Schedule I / second-conviction facts support it (BNS §78 first offence is generally bailable).
- Do NOT demand "must arrest" / "direct arrest".

CITATION RULES:
- Statute + facts suffice — do NOT invent AIR/SCC case citations.
- Never pin a substantive section that is not grounded in facts (do not default every FIR to BNS §78).`,

  india_complaint_magistrate_bnss_223: `You are drafting a Complaint to Magistrate under BNSS §223 (private complaint — NOT an FIR under BNSS §173).

CAUSE TITLE: before the appropriate Magistrate; parties as Complainant vs Accused.
STRUCTURE: maintainability under BNSS §223, facts, offence sections from grounding, list of witnesses if known, prayer for process, verification.
Do NOT use police-station SHO addressee format. Do NOT invent facts.`,

  india_civil_plaint: `You are drafting a Plaint under CPC Order VII (Civil practice).

STRUCTURE: court heading, suit title, numbered paras (cause of action, jurisdiction, facts, relief claimed), verification.
Relief in precise terms with amounts. [BLANK: description] for missing particulars.
Do NOT invent facts or cite criminal arrest/bail language.`,

  india_nda_agreement: `You are drafting a Non-Disclosure Agreement (Contract practice).

STRUCTURE: title, date, parties/recitals, definitions, confidential information, obligations, term, exceptions, remedies, governing law (India), dispute resolution, signatures.
Numbered clauses. [BLANK: party names, term, jurisdiction].`,

  india_custom: `You are a senior Indian advocate. Draft the legal document that the user describes in their case details.

INSTRUCTIONS:
1. Identify the correct document type from the user's description (petition, application, agreement, notice, complaint, etc.).
2. Use the correct cause-title vehicle and court heading for that document type.
3. Structure the document with proper numbered paragraphs, grounds (if a pleading), prayer, and verification.
4. Use current Indian law (BNS/BNSS/BSA 2023 where applicable; CPC/Contract Act/Consumer Protection Act etc. as relevant).
5. All legal propositions MUST cite verified authorities or sections. Do NOT fabricate case names or citations.
6. Use [BLANK: description] for any fact not provided by the user.
7. Do NOT add preambles, disclaimers, or "Jurisdiction Confirmed" boilerplate.`,
};

export function resolveIndiaDraftPrompt(kind: string, defaultPrompt: string): string {
  return INDIA_RICH_PROMPT_OVERRIDES[kind] ?? defaultPrompt;
}
