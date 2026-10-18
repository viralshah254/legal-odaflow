import type { LegalDomain } from './legal-research-classifier.service';

/**
 * Domain-specific research checklists. Injected into the research prompt based on
 * the classified legal domain so the model considers the right elements, defences,
 * procedure, and risks for that area of law.
 */
const DOMAIN_CHECKLISTS: Record<LegalDomain, string[]> = {
  CRIMINAL: [
    'Ingredients of the offence: enumerate each statutory element including the mens rea requirement (if any); do not assume mens rea without statutory basis.',
    'Offence classification: cognizable/non-cognizable, bailable/non-bailable, compoundable/non-compoundable — state police arrest powers ONLY if the offence is cognizable; FIR only for cognizable offences.',
    'Burden of proof and any statutory presumptions (and how they are rebutted); distinguish evidential burden from legal burden.',
    'Limitation period for filing complaint/FIR; court of cognizance, trial forum, and jurisdiction (place of offence/commission).',
    'Sentencing range: imprisonment/fine/both; mandatory minimums (if any); factors in mitigation and aggravation.',
    'Available defences: general (consent, mistake of fact, etc.) and special; quashing grounds (lack of ingredients, abuse of process); applicability of each to the facts.',
    'Compounding/settlement route: which offences are compoundable, at what stage, with whose consent, and court\'s role — compounding is not automatic acquittal.',
    'Appeal/revision path: sessions court, high court, apex court; grounds; limitation; bail during appeal.',
    'New criminal code transitional issues (India): BNS/BNSS/BSA vs IPC/CrPC/Evidence Act — applicable code depends on date of offence and procedural step; section numbers differ and must be verified.',
  ],
  CIVIL_LITIGATION: [
    'Cause of action: identify precisely when it accrued and whether it is complete; a cause of action that has not accrued cannot be sued on.',
    'Limitation: applicable article in the Limitation Act schedule; date of accrual; whether any acknowledgement/part-payment has extended time; no s.5 condonation for suits (India).',
    'Jurisdiction: territorial (where cause of action arose, where defendant resides/carries on business), pecuniary (court fee/valuation), subject-matter (civil court vs specialised tribunal); do not assume civil court jurisdiction where a tribunal has exclusive jurisdiction.',
    'Parties: necessary and proper parties; capacity; representative suits (O.1 r.8 CPC); cause title requirements.',
    'Interim relief: injunction (prima facie case, balance of convenience, irreparable harm — all three elements required); attachment before judgment; receiver.',
    'Burden/standard of proof: civil standard (balance of probabilities); shifting burden after presumptions.',
    'Available remedies: specific relief, declaration, injunction, damages, recovery of possession — identify which are available and conditions for each.',
    'Execution: mode of execution; resistance; substituted service; contempt.',
    'Appeal/revision: first/second appeal; revision; review; limitations for each; whether appellate court can re-appreciate evidence.',
    'Court fees: ad-valorem vs fixed; refusal consequences; amendment.',
  ],
  CONTRACT: [
    'Formation: offer, acceptance, communication, consideration, capacity, free consent — verify each element on the facts.',
    'Formality requirements: writing/registration/stamp duty required only for specific categories (e.g. sale of immovable property, mortgage, guarantee in some jurisdictions); do not assume writing is always required.',
    'Vitiating factors: fraud, coercion, undue influence, misrepresentation, mistake — each has specific elements; void vs voidable consequences differ.',
    'Breach: anticipatory vs actual; repudiatory vs non-repudiatory; doctrine of election after repudiation.',
    'Damages: expectation (putting in position as if performed), reliance, restitution; duty to mitigate; consequential/special damages (Hadley v Baxendale foreseeability rule); agreed/liquidated damages vs penalty clauses.',
    'Specific performance: available for unique goods/property; post-2018 in India made ordinarily enforceable for immovable property; bars (ss.11(2), 14, 16 SRA); substitute via s.20 SRA.',
    'Termination/rescission: right vs election; restitution obligations; accrued rights survive termination.',
    'Force majeure/frustration: specific events contracted for vs frustration doctrine; party must not have self-induced the event; consequences (discharge, not excuse for past performance).',
    'Arbitration clause: separability; scope of disputes covered; applicable institutional rules; seat and venue distinction; governing law of arbitration vs substantive contract.',
    'Limitation: from date of breach (accrual); part-payment or acknowledgement may restart clock.',
  ],
  CONSTRUCTION_DELAY: [
    'Governing contract and form: identify FIDIC/edition or bespoke form; EOT notice machinery; employer risk events; concurrent delay allocation; liquidated damages vs general damages.',
    'Delay analysis methodology: compare the methods in issue (e.g. SCL Delay and Disruption Protocol vs ASCE schedule delay analysis) — time impact, windows, as-planned vs as-built, collapsed as-built — and state which method fits the available records and critical path evidence.',
    'Common-law reception: where the forum is a common-law jurisdiction (including Uganda and other East African common-law systems), explain why UK SCL Protocol materials and comparative case law may be persuasive even if not binding; do not treat them as local statute.',
    'Critical path and concurrency: distinguish critical vs non-critical delay; true concurrency vs sequential delay; employer-caused vs contractor-caused delay; float ownership if the contract addresses it.',
    'Disruption vs delay: prolongation/time-related preliminaries vs loss of productivity; required proof for each head.',
    'Records: baseline programme, updates, as-built data, notices, instructions, weather/force majeure logs — identify missing records that would change the methodology choice.',
    'Remedy interaction: EOT (time) vs prolongation costs (money); LD enforcement after EOT; acceleration claims.',
    'Dispute forum: DAB/DAAB, arbitration seat, governing law of the contract vs lex fori — keep them distinct.',
    'Local primary sources: retrieve ULII / national legislation / project-specific statutes where available; label comparative doctrine as analytical guidance until local authorities are retrieved.',
  ],
  CORPORATE_COMMERCIAL: [
    'Entity type: company (private/public/OPC/LLP/partnership); corporate personality; veil-piercing is exceptional — state the criteria.',
    'Board/shareholder authority: powers of board vs powers reserved for shareholders; ordinary vs special resolution; quorum; board approvals under Companies Act, 2013.',
    'Director duties: fiduciary duties, duty of care; conflict of interest; related-party transactions (s.188 Companies Act, 2013) — require board/shareholder approval; consequences of breach.',
    'Regulatory approvals: SEBI (listed companies), RBI (FDI/ECB/FEMA), CCI (competition/merger approval), sector regulators; timeline and consequence of non-compliance.',
    'Liability: limited liability of shareholders is the default; director liability requires specific statutory basis (e.g. fraudulent trading, wilful default) — do not assume personal liability.',
    'Insolvency risk: IBC threshold (India: ₹1 crore for corporate), CIRP timeline, moratorium effect, resolution plan, liquidation; distinguish NCLT (corporate insolvency) from DRT (personal guarantor).',
    'Share transfer/allotment: pre-emption rights, right of first refusal, stamp duty on share transfer; free transferability in public companies vs restrictions in private companies.',
    'Dispute forum: NCLT (Companies Act matters), SEBI adjudication, arbitration (if agreed), commercial court (commercial disputes), civil court (residual).',
  ],
  INSOLVENCY: [
    'Debtor category and applicable provision: corporate (CIRP under IBC Part II, NCLT), individual/personal guarantor (IBC Part III — verify notification status), partnership/LLP (IBC s.2(1)(e)).',
    'Default threshold and minimum debt: verify current threshold; operational vs financial creditor distinction and their different standing.',
    'Moratorium under IBC s.14: scope (prohibits suits, enforcement, asset transfer); exceptions (regulatory actions, criminal proceedings — insolvency does NOT stay criminal proceedings without authority).',
    'Resolution Professional (RP), CoC, resolution plan timelines; strict IBC timelines (180+90 day CIRP period); judicial extensions limited.',
    'Fraudulent, preferential, undervalued transactions: look-back periods, requirements, reversal mechanism (IBC ss.43–66).',
    'Personal guarantor insolvency (IBC Part III): partially notified; DRT as adjudicating authority for most purposes; do not present IBC personal insolvency as a straightforward or immediately available route.',
    'IBC vs other insolvency laws: Presidency Towns Insolvency Act, Provincial Insolvency Act — may apply to individuals where IBC Part III is not notified.',
    'Impact on criminal proceedings: insolvency resolution does NOT automatically stay/discharge criminal liability or s.138 NI Act proceedings — require explicit authority before stating otherwise.',
    'Cross-border insolvency: UNCITRAL Model Law not yet adopted by India; limited mutual recognition.',
  ],
  FAMILY: [
    'Applicable personal law: Hindu, Muslim, Christian, Parsi, or Special Marriage Act — do not assume the applicable law without confirming the parties\' religion/choice.',
    'Marriage validity: essential conditions (capacity, prohibited degrees, monogamy requirements); void vs voidable marriage.',
    'Divorce grounds: vary significantly by personal law; irretrievable breakdown is a recognised ground in some laws/jurisdictions but not universally; confirm applicable statute.',
    'Maintenance: interim and permanent maintenance; factors (income, assets, conduct); enforcement (attachment of salary, contempt); domestic violence Act reliefs run parallel.',
    'Custody: welfare of the child is paramount; interim custody; contested hearings; relocation issues.',
    'Domestic violence: Protection of Women from Domestic Violence Act, 2005 (India) — civil remedies (protection order, residence order, monetary relief); distinct from criminal proceedings.',
    'Matrimonial property: no community of property in most Indian personal laws; specific assets/contributions relevant; joint accounts, HUF property distinct.',
    'Jurisdiction: for matrimonial matters (where parties last resided together, where respondent resides, where marriage solemnised — varies by law); enforce foreign divorce orders carefully.',
    'Limitation: most matrimonial petitions have no specific bar but undue delay may be relevant; maintenance enforcement has limitation.',
    'Mediation: mandatory MIAM/mediation in some jurisdictions before contested proceedings; in India, mediation pre-2023 was discretionary; check current local rules.',
  ],
  PROPERTY: [
    'Landlord–tenant / premature vacate notice: start with the lease and TPA 1882 ss.105–111 (especially s.106 notice and s.111 determination). Specific Relief ss.34/38/39 and CPC O.39 rr.1–2 for declaration and injunction against self-help dispossession. Contract Act ss.37/73 for performance and damages. State rent-control / Model Tenancy Act overlays when the state is known — do not refuse the TPA analysis when state is unknown. Article 21 / Olga Tellis is not controlling against a private landlord absent state action. Lack of alternative accommodation is hardship, not a free-standing statutory bar.',
    'Title, possession, registration, stamp duty, mutation, encumbrances — distinguish agreement to sell (no title transfer) from registered sale deed (title transferred).',
    'TPA s.54: an agreement for sale does not by itself create any interest in or charge on the property — only a registered sale deed transfers title.',
    'Specific Relief Act, 1963 — post-2018: s.10 makes specific performance ordinarily enforceable for immovable property; s.16 (readiness/willingness) and ss.11(2), 14 remain bars; s.20 now governs substituted performance (not old hardship discretion).',
    'Registration Act, 1908 — s.49 proviso: an unregistered agreement to sell may be received as evidence of a contract in a specific performance suit; it cannot ground a s.53A TPA part-performance defence after the 2001 amendment.',
    'Stamp duty risk: insufficient stamp duty (Indian Stamp Act, 1899 / state stamp acts) may render a document inadmissible until duty + penalty paid — this is the primary practical risk, not void/unenforceability.',
    'Limitation: Art. 54, Limitation Act, 1963 — 3 years from date fixed for performance, or from when plaintiff has notice of refusal. No s.5 condonation for suits.',
    'Injunction: prima facie case, balance of convenience, irreparable harm (CPC O.39 rr.1–2); lis pendens once suit filed; mandatory injunction has a higher threshold.',
    'Third-party rights: Specific Relief Act, 1963, s.19(b) bars specific performance against a bona fide purchaser for value without notice — NOT TPA s.19.',
    'CPC s.148A caveat = filed in the competent court (not Sub-Registrar); Sub-Registrar administrative objection = separate state-specific step, not a substitute for injunction.',
    'RERA (India): applies only to registered promoters/developers and registered real estate projects; does not apply to individual sellers or resale transactions.',
    'Criminal route (BNS): cheating (BNS s.318) only where fraudulent intent at inception; criminal breach of trust (BNS s.316) where fiduciary; criminal proceedings secondary and courts may stay if purely civil.',
    'State-specific rules: stamp duty rates, agricultural land transfer restrictions, zoning/revenue records.',
  ],
  CONSTITUTIONAL: [
    'Maintainability: writ jurisdiction (High Court/Supreme Court); locus standi; whether a fundamental/constitutional right is engaged; ripeness.',
    'Alternative remedy: most courts will not entertain a writ where an effective alternative remedy (appeal, statutory forum) exists — check whether the exception (violation of natural justice, constitutional question, futility) applies.',
    'State action requirement: fundamental rights bind the "state" as defined in Art. 12 (India); identify whether the respondent qualifies as "state"; note extended scope for bodies discharging public functions.',
    'Proportionality and reasonableness: distinguish Art. 14 (equality/arbitrariness), Art. 19 (freedom with reasonable restrictions), Art. 21 (life and liberty) — each has distinct tests.',
    'Scope of judicial review: merits review vs supervisory review; courts generally do not substitute their decision for a legislative/administrative decision on the merits.',
    'Natural justice: audi alteram partem, bias, reasoned decision — these are grounds for review but procedural violations may not always result in setting aside (prejudice required in some tests).',
    'Separation of powers: legislature, executive, judiciary — courts are cautious about directing legislative action or executive policy.',
    'Constitutional amendments: procedure; basic structure doctrine (India — Kesavananda Bharati); Constituent Assembly power.',
    'Interim relief (stay): test for staying subordinate legislation or executive action; balance of convenience.',
  ],
  TAX: [
    'Identify the exact tax head: income tax, GST, customs, stamp duty, etc. — each has its own statute, rate, and procedural path. Do not mix rules across heads.',
    'Verify the statute version in force for the assessment year/period: tax laws change frequently; confirm applicable AY/FY, applicable Finance Act amendments, and relevant notifications/circulars.',
    'Assessment procedure: self-assessment, scrutiny, reassessment (s.148 ITA) — verify limitation for reassessment; faceless assessment (India) — understand the procedure.',
    'Notices: identify type of notice (scrutiny, show-cause, demand); limitation to respond; consequences of non-response vs response.',
    'Demand and recovery: modes of recovery; stay of demand pending appeal (discretionary, not automatic); attachment; TRO.',
    'Penalties and prosecution: distinguish civil penalty (compoundable, civil liability) from criminal prosecution (wilful default/fraud — different elements, different consequences).',
    'Appeal path: CIT(A)/NFAC → ITAT → High Court (substantial question of law) → Supreme Court; each forum has its own limitation and admission criteria.',
    'GST (India): CGST/SGST/IGST; place of supply rules; input tax credit conditions and reversals; anti-profiteering; GST Appellate Authority.',
    'Transfer pricing: arm\'s length principle; documentation; penalties for non-compliance; advance pricing agreements.',
    'Always caution that tax rates, exemptions, and thresholds change with each Finance Act; verify current rates against official MoF/CBDT/CBIC circulars.',
  ],
  EMPLOYMENT: [
    'Worker classification: employee vs independent contractor vs gig worker — consequences for labour law applicability (EPF, ESI, gratuity, termination protection); do not assume without facts.',
    'Applicable statute: identify whether the new Labour Codes (India: Code on Wages, Industrial Relations Code, Code on Social Security, OSHWC Code) are notified/in force in the relevant state; predecessor statutes (Factories Act, ID Act, etc.) remain operative until code rules notified.',
    'Threshold applicability: many statutes apply only above an employee-number or wages threshold; confirm threshold and whether employer qualifies.',
    'Termination: standing orders, inquiry procedure (misconduct), notice/retrenchment compensation; retrenchment vs closure vs VRS; Industrial Disputes Act procedures (standing orders, conciliation, adjudication) where applicable.',
    'Wages: minimum wage (state-specific, frequently revised); overtime; deduction rules; payment mode; gratuity (5+ years) and bonus (as applicable).',
    'Social security: EPF/EPS, ESI, NPS — applicability thresholds; contribution rates; withdrawal rules.',
    'Discrimination and harassment: POSH Act, 2013 (India) — Internal Complaints Committee, procedural obligations, employer liability; no separate general anti-discrimination statute in India (as of current).',
    'Forum: Labour Court/Industrial Tribunal (industrial disputes), High Court (service matters for certain employers), civil court (independent contractor disputes), POSH committee (harassment).',
    'Fixed-term employees: rights and termination differ from permanent employees; check applicable code/statute.',
    'Non-compete/confidentiality: enforceability post-employment varies by jurisdiction; in India, s.27 Indian Contract Act generally bars post-employment non-competes (with limited exceptions).',
  ],
  INTELLECTUAL_PROPERTY: [
    'Right type and subsistence: patent (utility/design/plant variety), trademark, copyright, design registration, geographical indication — each has distinct subsistence requirements and duration.',
    'Registration and priority: trademark/design registration confers statutory rights; copyright is automatic in most jurisdictions on creation; check whether registration was required, when filed, and priority claims.',
    'Ownership and assignment: first ownership (employer/employee work-for-hire rules differ by IP type and jurisdiction); assignment requirements (written, registered for some); licences vs assignments.',
    'Infringement test: direct vs indirect; likelihood of confusion (trademark); substantial similarity (copyright); claim construction (patent); do not apply one test to another IP type.',
    'Defences: fair use/fair dealing (copyright — exhaustive list in some systems, flexible in others); prior use (trademark); invalidity of the IP right (most powerful defence — challenge the right itself); exhaustion/first sale.',
    'Remedies: interim injunction (balance of convenience; delay/acquiescence may weaken); permanent injunction; damages (actual, exemplary); account of profits; delivery up/destruction.',
    'Forum: High Court or IP specialised court/IP Appellate Board (where it exists); jurisdiction — where infringement occurs or where defendant resides/operates.',
    'Limitation: varies by IP type and jurisdiction; delay/laches may bar equitable relief even within limitation.',
    'Domain name disputes: UDRP (WIPO) or domestic dispute resolution; separate from trademark infringement.',
  ],
  CONSUMER: [
    'Consumer status: a "consumer" under Consumer Protection Act (India) must purchase goods/services for personal use, not for commercial resale; a person who purchases for commercial purpose is generally excluded.',
    'Deficiency of service vs product defect: identify precisely; manufacturing defect, design defect, and inadequate warning are distinct; service deficiency requires standard of reasonable care.',
    'Banking / unauthorised UPI: cover the regulated entity\'s internal complaint process first, including acknowledgement, investigation, provisional/final response, reversal or compensation sought, and preservation of transaction/device/complaint records.',
    'RBI Integrated Ombudsman Scheme: verify that the respondent is a covered regulated entity, the complainant first approached it, the response/waiting-period and filing-time requirements, exclusions/maintainability, filing process, and available relief; do not present the Ombudsman as the first step.',
    'Consumer Commission route for banking/payment/digital-lending disputes: analyse deficiency in service and any unfair trade practice separately, consumer status, jurisdiction, limitation, evidence, relief, and overlap with (not automatic exclusion by) RBI grievance remedies.',
    'Cyber-fraud route: identify immediate reporting to the National Cyber Crime Reporting Portal/1930 and the appropriate cybercrime police station; distinguish reporting and investigation from a guaranteed FIR, recovery, or finding of bank liability.',
    'Civil relief where disputed liability, recovery, account blocking, adverse reporting, or threatened enforcement requires it: consider declaration/non-liability and temporary/permanent injunction, with the applicable jurisdiction, limitation, and injunction test.',
    'Digital lending responsibility: identify and analyse the RBI-regulated entity/lender separately from any lending service provider, app, payment intermediary, recovery agent, or merchant; outsourcing does not erase the regulated entity\'s regulatory responsibility, but each party\'s civil liability still needs a pleaded factual and legal basis.',
    'Digital-lending lifecycle: test KYC and onboarding/consent, disclosures and key fact statement, loan-account creation, disbursal and repayment funds flow, data/device use, grievance handling, and recovery-agent identity and conduct against the facts and applicable RBI directions.',
    'Pecuniary jurisdiction (India): District Commission (up to ₹50 lakh), State Commission (₹50 lakh–₹2 crore), National Commission (above ₹2 crore); verify current thresholds as they change.',
    'Territorial jurisdiction: where opposite party resides/has branch/carries on business, or where cause of action arose; complainant\'s residence also grounds jurisdiction (CPA 2019 change).',
    'Limitation: 2 years from date of cause of action; condonation available if sufficient cause shown (unlike limitation for ordinary suits — consumer forums have discretion).',
    'Mediation: mandatory mediation (pre-litigation) under CPA 2019 before first hearing; explore settlement.',
    'Remedies: refund, replacement, repair, compensation for injury/loss, punitive damages, discontinue unfair trade practice; RERA and consumer forum jurisdiction may overlap for property disputes.',
    'E-commerce: CPA 2019 rules on e-commerce platforms (liability as platform vs seller); product liability extended to manufacturers, sellers, and service providers.',
    'Appeal: District Commission → State Commission → National Commission → Supreme Court; limitation for each; pre-deposit requirement at appellate stages.',
    'Unfair trade practice vs restrictive trade practice: specific definitions; burden of proof on complainant.',
  ],
  DATA_PRIVACY: [
    'Applicable regime and notification status: in India, Digital Personal Data Protection Act, 2023 (DPDPA) — check which sections/rules are in force and when; GDPR (EU); CCPA (California); PDPA (various); regimes differ materially.',
    'Data fiduciary/controller vs data processor/processor: obligations differ; identify the party\'s role in the data processing chain.',
    'Lawful basis: consent (freely given, informed, specific); legitimate interest; legal obligation; vital interest; contract; each regime has different conditions — do not assume GDPR consent rules apply universally.',
    'Data subject/principal rights: access, correction, erasure, portability, objection — availability and scope varies by regime; time limits for response.',
    'Breach notification: regime-specific timelines (GDPR: 72 hours to authority; affected individuals: without undue delay where high risk); not all regimes require notification.',
    'Cross-border transfer restrictions: adequacy decisions, standard contractual clauses, binding corporate rules, derogations — verify which apply to the jurisdiction and data type.',
    'Sectoral overlaps: financial data, health data, children\'s data often have additional requirements; identify overlapping sectoral regulations.',
    'Enforcement authority: Data Protection Board (India), ICO (UK), DPAs (EU), FTC (US) — penalties vary significantly; distinguish administrative fine from criminal liability.',
    'Retention and deletion obligations: minimum/maximum retention periods often sector-specific; verify applicable rules before advising.',
    'Processor/sub-processor obligations: written contracts, instructions, sub-processing restrictions — vary by regime.',
  ],
  IMMIGRATION: [
    'Visa category and eligibility: identify the precise visa/permit category; eligibility conditions are highly specific; do not generalise across categories.',
    'Governing rules and current policy: immigration rules change frequently; always verify against current official guidance (not outdated summaries); advise client accordingly.',
    'Application process: authority, form, supporting documents, biometrics, fees; in-country vs out-of-country application distinction.',
    'Timelines: processing times vary significantly; distinguish legal/regulatory deadlines from administrative processing times.',
    'Maintenance of status: conditions of visa/permit; employment restrictions; changes of circumstance (change of employer, address) and notification/amendment requirements.',
    'Overstay and status violations: consequences (removal, future bars, criminal liability where applicable); do not overstate criminal risk for civil immigration violation without authority.',
    'Appeal and administrative review: appeal to immigration tribunal, judicial review; time limits (often very short — verify); suspensive effect of appeal on removal.',
    'Deportation/removal: due process requirements; humanitarian protection, asylum (non-refoulement obligation); representation rights.',
    'Citizenship and naturalisation: conditions, residence periods, language tests, renunciation requirements; naturalisation is discretionary in most jurisdictions — do not guarantee.',
    'Family members: derivative status, dependant visa rules, family reunification — conditions and procedures specific to the jurisdiction and primary applicant category.',
  ],
  ARBITRATION: [
    'Arbitration agreement: existence, validity (in writing — most regimes), scope (which disputes are arbitrable); separability from the main contract (survives contract unenforceability in most regimes).',
    'Arbitrability: certain disputes are non-arbitrable (e.g. criminal matters, certain family/insolvency disputes, consumer disputes in some jurisdictions) — identify jurisdiction-specific non-arbitrable categories.',
    'Seat vs venue: seat determines the curial law (supervisory jurisdiction of courts); venue is where hearings take place — these differ and the distinction is legally significant.',
    'Governing law: law of the arbitration agreement; law of the substantive contract; lex arbitri (curial law) — three potentially distinct laws; identify each.',
    'Appointment and challenge: procedure for appointing arbitrators; grounds for challenge; time limits; institutional vs ad hoc.',
    'Kompetenz-kompetenz: tribunal rules on its own jurisdiction as a primary matter; courts have limited intervention before the award in most modern regimes.',
    'Interim measures: from the tribunal (if agreed) and from courts (Arbitration Act s.9 India, Art. 17 UNCITRAL ML) — both available in most regimes; urgency may require court measure.',
    'Conduct of proceedings: procedure; evidence; confidentiality (varies — not automatic in all regimes); document production; provisional timeline and costs.',
    'Award: form, content, delivery; additional/correction/interpretation (within time limits); publication (generally confidential in commercial arbitration).',
    'Challenge/set-aside: grounds are limited and jurisdiction-specific (public policy, excess of jurisdiction, procedural unfairness, invalidity of agreement, non-arbitrability); merits review is generally excluded.',
    'Enforcement: New York Convention (157 signatories) for foreign awards; domestic enforcement procedure; grounds to resist enforcement overlap with set-aside grounds.',
    'Limitation: for commencing arbitration, varies by applicable limitation law and any contractual time bar — check whether the time bar is a condition precedent or merely a procedural limit.',
  ],
  GENERAL: [
    'Identify the governing jurisdiction and the applicable legal test/elements; confirm the correct statute or common law rule.',
    'Identify required facts, available evidence, and the procedural posture (pre-filing, pending proceedings, post-judgment).',
    'Identify defences/counterarguments; the existence of a good defence is as important as the strength of the main claim.',
    'Identify limitation/time bars; note whether any extension or waiver mechanism applies.',
    'Identify the correct forum and jurisdiction for each claim; do not mix court and tribunal jurisdiction.',
    'Identify risks and weaknesses; avoid one-sided analysis.',
    'Identify practical next steps; distinguish urgent actions (injunctions, limitation deadlines) from medium-term steps.',
    'Flag missing facts that would materially change the analysis.',
  ],
};

const KE_DOMAIN_CHECKLISTS: Partial<Record<LegalDomain, string[]>> = {
  CRIMINAL: [
    'Kenya: verify the Penal Code (Cap 63), Criminal Procedure Code (Cap 75), Constitution arts. 49–50, offence classification, bond/bail, trial court, and appeal route using current Kenya Law text.',
  ],
  CIVIL_LITIGATION: [
    'Kenya: verify the Civil Procedure Act and Rules, Limitation of Actions Act (Cap 22), pecuniary/territorial jurisdiction, specialised-court jurisdiction, and the appeal route.',
  ],
  CONTRACT: [
    'Kenya: prefer the Law of Contract Act (Cap 23), applicable Sale of Goods/Consumer Protection legislation, and Kenyan common-law authority; do not import Indian contract statutes.',
  ],
  CORPORATE_COMMERCIAL: [
    'Kenya: verify the Companies Act 2015, Insolvency Act 2015, beneficial-ownership rules, regulator/forum, and the current statutory text.',
  ],
  INSOLVENCY: [
    'Kenya: verify the Insolvency Act 2015, debtor category, statutory demand requirements, moratorium/liquidation consequences, and High Court jurisdiction.',
  ],
  FAMILY: [
    'Kenya: identify the applicable Marriage Act 2014 regime, Matrimonial Property Act 2013, Children Act 2022, or Law of Succession Act (Cap 160), including the competent court.',
  ],
  PROPERTY: [
    'Kenya: verify the Land Act 2012, Land Registration Act 2012, Environment and Land Court Act, limitation/adverse-possession requirements, and whether the ELC or a magistrate has jurisdiction.',
  ],
  CONSTITUTIONAL: [
    'Kenya: analyse the Constitution of Kenya 2010, including arts. 22–23, 47, 159 and 165 where relevant; distinguish High Court and specialised superior-court jurisdiction.',
  ],
  TAX: [
    'Kenya: verify the Income Tax Act (Cap 470), VAT Act 2013, Tax Procedures Act 2015, objection deadlines, exhaustion requirements, and Tax Appeals Tribunal appeal route.',
  ],
  EMPLOYMENT: [
    'Kenya: verify Employment Act 2007 ss. 41, 43, 45 and 49 where relevant, Labour Relations Act 2007, limitation, internal process, and ELRC jurisdiction.',
  ],
  CONSUMER: [
    'Kenya: verify the Consumer Protection Act 2012 and any sector regulator rules; identify the correct forum and do not import Indian consumer-commission thresholds.',
  ],
  ARBITRATION: [
    'Kenya: verify the Arbitration Act 1995 (as amended), seat, High Court intervention, setting-aside deadlines, and enforcement under the New York Convention.',
  ],
  GENERAL: [
    'Kenya: use current Kenya Law primary text and Kenyan authorities; state any unresolved statutory version, court, or jurisdiction question explicitly.',
  ],
};

/**
 * Builds the domain-checklist prompt block for the classified legal domain.
 */
export function buildDomainChecklistBlock(domain: LegalDomain, jurisdiction?: string): string {
  const items = DOMAIN_CHECKLISTS[domain] ?? DOMAIN_CHECKLISTS.GENERAL;
  const jurisdictionItems =
    jurisdiction?.trim().toUpperCase() === 'KE'
      ? [...(KE_DOMAIN_CHECKLISTS[domain] ?? KE_DOMAIN_CHECKLISTS.GENERAL ?? [])]
      : [];
  return [
    `DOMAIN RESEARCH CHECKLIST — ${domain.replace(/_/g, ' ')}${jurisdictionItems.length > 0 ? ' (KE)' : ''} (address each that is relevant):`,
    ...jurisdictionItems.map((i) => `  - ${i}`),
    ...items.map((i) => `  - ${i}`),
  ].join('\n');
}
