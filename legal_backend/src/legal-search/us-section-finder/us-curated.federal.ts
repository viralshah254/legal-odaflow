import { buildUsSectionFinderEntry } from './us-entry.factory';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';

function fed(
  actId: string,
  actShort: string,
  actFull: string,
  section: string,
  title: string,
  summary: string,
  extra?: import('./us-entry.factory').UsCuratedSectionExtra,
): SectionFinderEntry {
  return buildUsSectionFinderEntry({
    actId,
    actShort,
    actFull,
    section,
    title,
    changeSummary: summary,
    ...extra,
  });
}

function fedRow(
  actId: string,
  actShort: string,
  actFull: string,
  section: string,
  title: string,
  summary: string,
  extra?: import('./us-entry.factory').UsCuratedSectionExtra,
): { actId: string; entry: SectionFinderEntry } {
  return { actId, entry: fed(actId, actShort, actFull, section, title, summary, extra) };
}

const FEDERAL_ROWS = [
  // ── FLSA ────────────────────────────────────────────────────────────────────
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '201', 'Definitions', 'Defines employer, employee, agriculture, and related terms for FLSA coverage.'),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '203', 'Administrative regulations and orders', 'Authorizes DOL regulations implementing minimum wage and overtime requirements.'),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '206', 'Minimum wage', 'Sets federal minimum wage requirements for covered non-exempt employees.', { punishment: 'Civil penalties and back wages; willful violations may involve criminal fines.' }),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '207', 'Maximum hours — overtime', 'Requires overtime at one and one-half the regular rate for hours over 40 in a workweek.', { practiceNote: 'Exemption analysis (executive, administrative, professional, outside sales, computer) is fact-intensive.' }),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '213', 'Exemptions', 'Lists categories of employees and employers exempt from minimum wage or overtime.'),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '215', 'Prohibited acts; penalties', 'Prohibits shipping goods produced in violation of FLSA and sets enforcement penalties.'),
  // ── Title VII ─────────────────────────────────────────────────────────────
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-2', 'Unlawful employment practices', 'Prohibits discrimination based on race, color, religion, sex, or national origin.', { practiceNote: 'EEOC charge filing and administrative exhaustion generally required before federal court.' }),
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-3', 'Other unlawful employment practices', 'Prohibits segregation, classification, and limiting opportunities that deprive employment opportunities.'),
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-5', 'Enforcement provisions', 'Authorizes EEOC investigation, conciliation, and suit; sets remedies including injunctive relief and back pay.'),
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-8', 'Periods of limitations', 'Sets time limits for filing EEOC charges.'),
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-16', 'Employment by Federal Government', 'Applies Title VII protections to federal employment.'),
  // ── ADA ───────────────────────────────────────────────────────────────────
  fedRow('ada', 'ADA', 'Americans with Disabilities Act of 1990', '12101', 'Findings and purpose', 'States congressional findings on discrimination against individuals with disabilities.'),
  fedRow('ada', 'ADA', 'ADA', '12102', 'Definition of disability', 'Defines disability, major life activities, and substantial limitation (as amended by ADAAA).'),
  fedRow('ada', 'ADA', 'ADA', '12111', 'Definitions', 'Defines covered entity, qualified individual, reasonable accommodation, and undue hardship.'),
  fedRow('ada', 'ADA', 'ADA', '12112', 'Discrimination', 'Prohibits discrimination against qualified individuals with disabilities in employment.'),
  fedRow('ada', 'ADA', 'ADA', '12113', 'Defenses', 'Sets business necessity and direct threat defenses; drug/alcohol rules.'),
  fedRow('ada', 'ADA', 'ADA', '12117', 'Enforcement', 'Incorporates Title VII enforcement procedures for employment discrimination claims.'),
  // ── FMLA ──────────────────────────────────────────────────────────────────
  fedRow('fmla', 'FMLA', 'Family and Medical Leave Act of 1993', '2601', 'Findings and purposes', 'Congressional findings on work-family balance and medical leave needs.'),
  fedRow('fmla', 'FMLA', 'FMLA', '2611', 'Definitions', 'Defines eligible employee, employer, serious health condition, and other key terms.'),
  fedRow('fmla', 'FMLA', 'FMLA', '2612', 'Leave requirement', 'Entitles eligible employees to 12 workweeks of leave per 12-month period for qualifying reasons.'),
  fedRow('fmla', 'FMLA', 'FMLA', '2614', 'Benefits during leave', 'Protects maintenance of health benefits during FMLA leave.'),
  fedRow('fmla', 'FMLA', 'FMLA', '2615', 'Denial of rights', 'Prohibits interference with FMLA rights and discrimination for taking leave.'),
  // ── Bankruptcy ────────────────────────────────────────────────────────────
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '101', 'Definitions', 'Defines debtor, estate, claim, creditor, and other core bankruptcy terms.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '109', 'Who may be a debtor', 'Sets eligibility requirements for voluntary bankruptcy petitions.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '362', 'Automatic stay', 'Stay of collection and enforcement actions upon petition filing.', { practiceNote: 'Relief from stay motions are common in secured creditor and landlord-tenant contexts.' }),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '503', 'Allowance of administrative expenses', 'Governs allowance and payment of administrative expense claims.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '507', 'Priorities', 'Sets priority order for distribution of estate assets.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '523', 'Exceptions to discharge', 'Lists debts excepted from discharge in individual cases.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '541', 'Property of the estate', 'Defines property comprising the bankruptcy estate.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '727', 'Discharge', 'Grants discharge to individual debtors in Chapter 7 subject to exceptions.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '1328', 'Discharge', 'Provides discharge in Chapter 13 upon completion of plan.'),
  // ── Immigration (INA) ─────────────────────────────────────────────────────
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1101', 'Definitions', 'Core immigration definitions including alien, immigrant, nonimmigrant.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1158', 'Asylum', 'Authorizes asylum for refugees physically present in the United States.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1182', 'Inadmissible aliens', 'Lists grounds of inadmissibility including health, criminal, security, and public charge.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '212', 'Documentary requirements at ports of entry', 'Documentation and waiver requirements for admission of immigrants and nonimmigrants.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1227', 'Deportable aliens', 'Lists grounds for deportation/removal of aliens.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1255', 'Adjustment of status of nonimmigrant to permanent resident', 'Governs adjustment of status to lawful permanent resident.'),
  // ── Title 18 — Federal crimes ─────────────────────────────────────────────
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1001', 'Statements or entries generally', 'False statements to federal investigators or agencies.', { punishment: 'Up to 5 years imprisonment (longer if tied to terrorism or certain financial crimes).' }),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1341', 'Fraud and swindles — mail fraud', 'Mail fraud scheme to defraud.', { punishment: 'Up to 20 years (30 if affecting financial institution or related to major disaster).' }),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1343', 'Wire fraud', 'Wire fraud in interstate or foreign commerce.', { punishment: 'Up to 20 years imprisonment.' }),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1346', 'Honest services fraud', 'Scheme to deprive another of intangible right of honest services.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1956', 'Money laundering', 'Prohibits financial transactions involving criminal proceeds.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1962', 'RICO prohibited activities', 'Prohibits racketeering patterns and enterprise conduct.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '371', 'Conspiracy to commit offense or defraud United States', 'General federal conspiracy statute.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '924', 'Firearms offenses', 'Penalties for firearms used or carried during crimes of violence or drug trafficking.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1028', 'Fraud and related activity in connection with identification documents', 'Identity document fraud and aggravated identity theft provisions.'),
  // ── Civil rights ──────────────────────────────────────────────────────────
  fedRow('section-1983', '§ 1983', '42 U.S.C. § 1983 — Civil action for deprivation of rights', '1983', 'Civil action for deprivation of rights', 'Civil suit against persons acting under color of state law who deprive constitutional or federal rights.', { trialCourtLabel: 'Federal district court (or state court concurrent jurisdiction per statute).' }),
  fedRow('section-1983', '§ 1983', '42 U.S.C. § 1983', '1988', 'Proceedings in vindication of civil rights', 'Attorney\'s fees in civil rights actions (fee-shifting for prevailing parties).'),
  // ── Securities ────────────────────────────────────────────────────────────
  fedRow('securities-act-1933', 'Securities Act 1933', 'Securities Act of 1933', '77a', 'Short title', 'Short title and basic framework for registration of securities offerings.'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78j', 'Manipulative and deceptive devices', 'Anti-fraud provision; basis for Rule 10b-5 enforcement.'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78u', 'SEC investigative and enforcement authority', 'SEC investigation, subpoena, and civil enforcement powers.'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78ff', 'Criminal penalties', 'Criminal penalties for willful violations of the Exchange Act.'),
  fedRow('sox', 'SOX', 'Sarbanes-Oxley Act of 2002', '802', 'Criminal penalties for altering documents', 'Criminal penalties for document destruction in federal investigations.'),
  fedRow('dodd-frank', 'Dodd-Frank', 'Dodd-Frank Wall Street Reform and Consumer Protection Act', '929P', 'Enhanced penalties for securities fraud', 'Enhanced criminal penalties for securities fraud offenses.'),
  // ── IP ────────────────────────────────────────────────────────────────────
  fedRow('copyright-act', 'Copyright Act', 'Copyright Act of 1976 (17 U.S.C.)', '106', 'Exclusive rights in copyrighted works', 'Lists exclusive rights of copyright owners.'),
  fedRow('copyright-act', 'Copyright Act', 'Copyright Act of 1976 (17 U.S.C.)', '107', 'Fair use', 'Fair use factors for limited use without permission.'),
  fedRow('copyright-act', 'Copyright Act', 'Copyright Act of 1976 (17 U.S.C.)', '501', 'Infringement of copyright', 'Remedies for copyright infringement including injunctions and damages.'),
  fedRow('patent-act', 'Patent Act', 'Patent Act (35 U.S.C.)', '101', 'Inventions patentable', 'Patentable subject matter (with judicial exceptions for abstract ideas, laws of nature).'),
  fedRow('patent-act', 'Patent Act', 'Patent Act (35 U.S.C.)', '102', 'Conditions for patentability; novelty', 'Novelty and prior art bars to patentability (AIA version).'),
  fedRow('patent-act', 'Patent Act', 'Patent Act (35 U.S.C.)', '103', 'Conditions for patentability; non-obvious subject matter', 'Non-obviousness requirement for patent claims.'),
  // ── ERISA / Labor (additional) ────────────────────────────────────────────
  fedRow('erisa', 'ERISA', 'Employee Retirement Income Security Act of 1974', '1002', 'Definitions', 'Defines plan, participant, beneficiary, fiduciary for ERISA plans.'),
  fedRow('erisa', 'ERISA', 'Employee Retirement Income Security Act of 1974', '502', 'Civil enforcement', 'Civil enforcement including benefits due and fiduciary breach claims.'),
  fedRow('erisa', 'ERISA', 'Employee Retirement Income Security Act of 1974', '510', 'Interference with protected rights', 'Prohibits discharge or discrimination for exercising ERISA rights.'),
  // ── Lanham / CFAA ─────────────────────────────────────────────────────────
  fedRow('lanham-act', 'Lanham Act', 'Lanham Act (Trademark)', '1114', 'Remedies; infringement; false designation', 'Trademark infringement remedies and false designation of origin.'),
  fedRow('cfaa', 'CFAA', 'Computer Fraud and Abuse Act', '1030', 'Computer fraud and abuse', 'Prohibits unauthorized access to protected computers and related conduct.'),
  // ── FRCP (as rule references) ─────────────────────────────────────────────
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '12', 'Defenses and objections — when and how presented', 'Rule 12 motions including dismissal for failure to state a claim.'),
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '23', 'Class actions', 'Requirements for class certification under Rule 23.'),
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '56', 'Summary judgment', 'Summary judgment standard — no genuine dispute of material fact.'),
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '26', 'Duty to disclose; general provisions governing discovery', 'Initial disclosures and scope of discovery.'),
  // ── Tax (Title 26 USC) ────────────────────────────────────────────────────
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '6012', 'Persons required to make returns of income', 'Who must file federal income tax returns.'),
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '6501', 'Limitations on assessment and collection', 'Statute of limitations on IRS assessment.'),
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '7201', 'Attempt to evade or defeat tax', 'Criminal tax evasion.', { punishment: 'Fine and/or imprisonment up to 5 years.' }),
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '6662', 'Imposition of accuracy-related penalty', 'Accuracy-related penalty on underpayments.'),
  // ── Sherman (antitrust) ───────────────────────────────────────────────────
  fedRow('sherman-act', 'Sherman Act', 'Sherman Antitrust Act', '1', 'Trusts, etc., in restraint of trade illegal', 'Prohibits contracts, combinations, or conspiracies in restraint of trade.'),
  fedRow('sherman-act', 'Sherman Act', 'Sherman Antitrust Act', '2', 'Monopolizing trade a felony', 'Prohibits monopolization, attempt, and conspiracy to monopolize.'),
  fedRow('sherman-act', 'Sherman Act', 'Sherman Antitrust Act', '7', 'Clayton Act — mergers and acquisitions', 'Prohibits acquisitions that may substantially lessen competition (Clayton Act § 7 codified in Sherman Act title context).'),
  // ── Additional Title VII / employment ─────────────────────────────────────
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-4', 'Equal Employment Opportunity Commission', 'Creates EEOC and sets its composition and duties.'),
  fedRow('title-vii', 'Title VII', 'Title VII of the Civil Rights Act of 1964', '2000e-6', 'Non-applicability of State law', 'Preemption framework for state antidiscrimination laws.'),
  fedRow('ada', 'ADA', 'Americans with Disabilities Act of 1990', '12103', 'Additional definitions', 'Regulatory definitions supplementing ADA Title I.'),
  fedRow('ada', 'ADA', 'Americans with Disabilities Act of 1990', '12114', 'Drug and alcohol use', 'Drug testing and current illegal drug use exclusions.'),
  fedRow('fmla', 'FMLA', 'Family and Medical Leave Act of 1993', '2613', 'Certification', 'Employer right to require medical certification for leave.'),
  fedRow('fmla', 'FMLA', 'Family and Medical Leave Act of 1993', '2617', 'Enforcement', 'DOL enforcement and private civil actions for FMLA violations.'),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '214', 'Child labor provisions', 'Restricts hours and occupations for minors.'),
  fedRow('flsa', 'FLSA', 'Fair Labor Standards Act of 1938', '216', 'Penalties', 'Civil and criminal penalties for FLSA violations.'),
  // ── Additional bankruptcy ─────────────────────────────────────────────────
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '102', 'Rules of construction', 'Rules of construction for the Bankruptcy Code.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '110', 'Penalties', 'Penalties for filing false oaths or fraudulent claims.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '365', 'Executory contracts and unexpired leases', 'Assumption and rejection of executory contracts.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '524', 'Effect of discharge', 'Scope of discharge injunction.'),
  fedRow('bankruptcy-code', 'Bankruptcy Code', 'Title 11 U.S.C. — Bankruptcy Code', '1322', 'Contents of plan', 'Mandatory and permissive contents of Chapter 13 plan.'),
  // ── Additional immigration ────────────────────────────────────────────────
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1184', 'Nonimmigrant visas', 'Temporary nonimmigrant visa categories including H-1B, L-1, etc.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1225', 'Inspection by immigration officers', 'Inspection, parole, and removal at ports of entry.'),
  fedRow('ina', 'INA', 'Immigration and Nationality Act', '1255a', 'Adjustment of status of refugees', 'Temporary and permanent status adjustments for asylees/refugees.'),
  // ── Additional Title 18 ───────────────────────────────────────────────────
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1028A', 'Aggravated identity theft', 'Mandatory consecutive 2-year term for aggravated identity theft.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1512', 'Tampering with witness, victim, or informant', 'Witness tampering and obstruction offenses.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1519', 'Destruction of records in federal investigations', 'Sarbanes-Oxley related document destruction offense.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1621', 'Perjury generally', 'Perjury before federal courts and grand juries.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '1951', 'Interference with commerce by threats or violence (Hobbs Act)', 'Hobbs Act robbery and extortion affecting interstate commerce.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '2314', 'Transportation of stolen goods', 'Interstate transportation of stolen property.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '242', 'Deprivation of rights under color of law', 'Criminal civil rights violation by public officials.'),
  fedRow('usc-18', '18 U.S.C.', 'Title 18 — Crimes and Criminal Procedure', '241', 'Conspiracy against rights', 'Conspiracy to injure, oppress, threaten, or intimidate any person in free exercise of rights.'),
  // ── Additional securities / corporate ─────────────────────────────────────
  fedRow('securities-act-1933', 'Securities Act 1933', 'Securities Act of 1933', '77e', 'Prohibitions relating to interstate commerce and mails', 'Prohibits sale of unregistered securities in interstate commerce.'),
  fedRow('securities-act-1933', 'Securities Act 1933', 'Securities Act of 1933', '77q', 'Fraudulent interstate transactions', 'Anti-fraud provisions for securities offerings.'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78m', 'Periodical and other reports', 'Periodic reporting requirements for public companies (10-K, 10-Q).'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78n', 'Proxy solicitation', 'Proxy solicitation rules and disclosure.'),
  fedRow('securities-exchange-act', 'Exchange Act 1934', 'Securities Exchange Act of 1934', '78o', 'Registration and regulation of brokers and dealers', 'Broker-dealer registration and regulation.'),
  // ── Additional IP / tech ──────────────────────────────────────────────────
  fedRow('copyright-act', 'Copyright Act', 'Copyright Act of 1976 (17 U.S.C.)', '102', 'Subject matter of copyright', 'Original works of authorship fixed in tangible medium.'),
  fedRow('copyright-act', 'Copyright Act', 'Copyright Act of 1976 (17 U.S.C.)', '504', 'Remedies for infringement', 'Actual damages, profits, statutory damages, and attorney\'s fees.'),
  fedRow('patent-act', 'Patent Act', 'Patent Act (35 U.S.C.)', '271', 'Infringement of patent', 'Direct, indirect, and contributory patent infringement.'),
  fedRow('lanham-act', 'Lanham Act', 'Lanham Act (Trademark)', '1125', 'False designations of origin and false descriptions', 'False advertising and false association claims (43(a)).'),
  // ── Additional civil procedure / evidence ─────────────────────────────────
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '8', 'General rules of pleading', 'Short and plain statement showing entitlement to relief.'),
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '11', 'Signing pleadings, motions, and other papers', 'Rule 11 sanctions for frivolous filings.'),
  fedRow('frcp', 'FRCP', 'Federal Rules of Civil Procedure', '37', 'Failure to make disclosures or cooperate in discovery', 'Discovery sanctions including dismissal and default.'),
  fedRow('fre', 'FRE', 'Federal Rules of Evidence', '401', 'Test for relevant evidence', 'Relevance standard for admissibility.'),
  fedRow('fre', 'FRE', 'Federal Rules of Evidence', '403', 'Excluding relevant evidence for prejudice, confusion, waste', 'Balancing test excluding relevant but unfairly prejudicial evidence.'),
  fedRow('fre', 'FRE', 'Federal Rules of Evidence', '702', 'Testimony by expert witnesses', 'Daubert standard for expert testimony admissibility.'),
  // ── Additional tax ────────────────────────────────────────────────────────
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '61', 'Gross income defined', 'Defines gross income for federal tax purposes.'),
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '162', 'Trade or business expenses', 'Ordinary and necessary business expense deduction.'),
  fedRow('usc-title-26', '26 U.S.C.', 'Internal Revenue Code (Title 26)', '501', 'Exemption from tax on corporations and trusts', 'Tax-exempt organization requirements.'),
  // ── Social Security / benefits ────────────────────────────────────────────
  fedRow('social-security-act', 'Social Security Act', 'Social Security Act', '402', 'Old-age and survivors insurance benefit payments', 'Social Security retirement and survivors benefits framework.'),
  fedRow('social-security-act', 'Social Security Act', 'Social Security Act', '416', 'Additional definitions', 'Disability and insured status definitions.'),
  // ── FOIA / admin ──────────────────────────────────────────────────────────
  fedRow('foia', 'FOIA', 'Freedom of Information Act', '552', 'Public information; agency rules and opinions', 'Public records access and agency disclosure obligations.'),
  fedRow('foia', 'FOIA', 'Freedom of Information Act', '552a', 'Records maintained on individuals (Privacy Act)', 'Privacy Act protections for federal agency records about individuals.'),
];

export const US_FEDERAL_CURATED: SectionFinderEntry[] = FEDERAL_ROWS.map((row) => row.entry);
export const US_FEDERAL_SEED_ACT_IDS: string[] = FEDERAL_ROWS.map((row) => row.actId);
