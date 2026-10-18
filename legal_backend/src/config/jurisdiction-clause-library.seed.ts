/**
 * Multi-jurisdiction clause library seed.
 * Provides jurisdiction-specific template variants for US states, IN, KE, and GB.
 * Each entry is a standalone template for a specific jurisdiction.
 */

export interface JurisdictionTemplateSeed {
  countryCode: string;
  jurisdiction: string; // e.g. "California", "England & Wales", "Kenya"
  practiceArea: string;
  name: string;
  documentKind: string;
  content: string;
  sortOrder: number;
}

const FOOTER = '<p><em>Draft for attorney review only — adapt to client facts and local rules before use.</em></p>';

function wrap(title: string, jurisdiction: string, body: string): string {
  return `<h1>${title}</h1><p><em>Jurisdiction: ${jurisdiction}</em></p>${body}<p>Client: {{clientName}}</p><p>Firm: {{firmName}}</p><p>Date: {{today}}</p>${FOOTER}`;
}

export const JURISDICTION_TEMPLATE_SEEDS: JurisdictionTemplateSeed[] = [
  // ── US — CALIFORNIA ────────────────────────────────────────────────────────────
  {
    countryCode: 'US',
    jurisdiction: 'California',
    practiceArea: 'employment_labour',
    name: 'California Employment Contract (At-Will)',
    documentKind: 'employment_contract',
    sortOrder: 1,
    content: wrap(
      'California At-Will Employment Agreement',
      'California, USA',
      `<p>This Employment Agreement is entered into between {{employerName}} ("Employer") and {{clientName}} ("Employee") effective {{startDate}}.</p>
<h2>1. Position and Duties</h2>
<p>Employee is employed as {{jobTitle}}. Employee agrees to perform all duties reasonably assigned by Employer.</p>
<h2>2. Compensation</h2>
<p>Base salary: {{salary}} per year, paid {{payFrequency}}. Employee is eligible for overtime in accordance with California Labor Code § 510.</p>
<h2>3. At-Will Employment</h2>
<p>Employment is at-will. Either party may terminate employment at any time, with or without cause or notice, subject to applicable California law.</p>
<h2>4. Non-Competition</h2>
<p>California Business & Professions Code § 16600 voids non-compete clauses except in limited circumstances. This agreement does not impose any non-compete restriction.</p>
<h2>5. Confidentiality</h2>
<p>Employee agrees to maintain the confidentiality of all proprietary information in accordance with the California Uniform Trade Secrets Act (Cal. Civ. Code § 3426 et seq.).</p>
<h2>6. Governing Law</h2>
<p>This Agreement is governed by the laws of the State of California.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'California',
    practiceArea: 'real_estate_property',
    name: 'California Residential Purchase Agreement',
    documentKind: 'sale_agreement',
    sortOrder: 1,
    content: wrap(
      'California Residential Purchase Agreement',
      'California, USA',
      `<p>This Agreement is entered into between {{vendorName}} ("Seller") and {{clientName}} ("Buyer") for the purchase of the real property located at {{propertyAddress}}.</p>
<h2>1. Purchase Price</h2>
<p>The Purchase Price is {{propertyPrice}}, payable as follows: deposit of {{depositAmount}} upon execution; balance due at closing.</p>
<h2>2. Contingencies</h2>
<p>This offer is contingent upon: (a) Buyer's inspection of the property (17 days); (b) Buyer obtaining financing (21 days); (c) Appraisal at or above Purchase Price.</p>
<h2>3. Disclosures</h2>
<p>Seller shall deliver all disclosures required by California Civil Code § 1102 et seq., including the Transfer Disclosure Statement (TDS) and Natural Hazard Disclosure (NHD).</p>
<h2>4. Closing</h2>
<p>Closing shall occur on {{completionDate}}. Escrow shall be handled by {{escrowCompany}}.</p>
<h2>5. Governing Law</h2>
<p>This Agreement is governed by California law. Disputes shall be resolved by mediation/arbitration per C.A.R. standard provisions.</p>`,
    ),
  },
  // ── US — NEW YORK ─────────────────────────────────────────────────────────────
  {
    countryCode: 'US',
    jurisdiction: 'New York',
    practiceArea: 'corporate_commercial',
    name: 'New York LLC Operating Agreement',
    documentKind: 'llc_operating_agreement',
    sortOrder: 1,
    content: wrap(
      'New York Limited Liability Company Operating Agreement',
      'New York, USA',
      `<p>This Operating Agreement of {{companyName}}, a New York Limited Liability Company, is entered into by the Member(s) listed herein.</p>
<h2>1. Formation</h2>
<p>The Company was formed upon filing Articles of Organization with the New York Department of State pursuant to the New York Limited Liability Company Law (NYLLCL).</p>
<h2>2. Members and Capital Contributions</h2>
<p>Initial Members and contributions: {{memberDetails}}</p>
<h2>3. Management</h2>
<p>The Company shall be: ☐ Member-managed ☐ Manager-managed. Manager: {{managerName}}</p>
<h2>4. Distributions</h2>
<p>Distributions shall be made in proportion to each Member's interest, subject to applicable NYLLCL requirements.</p>
<h2>5. Dissolution</h2>
<p>The Company shall dissolve upon the occurrence of events set forth in NYLLCL § 701, or by unanimous Member vote.</p>
<h2>6. Governing Law</h2>
<p>This Agreement is governed by the laws of the State of New York.</p>`,
    ),
  },
  // ── INDIA ─────────────────────────────────────────────────────────────────────
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'employment_labour',
    name: 'India Employment Agreement (IT/Services)',
    documentKind: 'employment_contract',
    sortOrder: 1,
    content: wrap(
      'Employment Agreement (India)',
      'India',
      `<p>This Employment Agreement is made between {{employerName}} ("Company") and {{clientName}} ("Employee") and shall be governed by the applicable laws of India.</p>
<h2>1. Appointment</h2>
<p>Employee is appointed to the position of {{jobTitle}} effective {{startDate}}, subject to successful completion of the probation period of {{probationPeriod}} months.</p>
<h2>2. Compensation</h2>
<p>CTC (Cost to Company): ₹{{salary}} per annum. This includes Basic Salary, HRA, Provident Fund contributions, and other allowances as per the Company's compensation structure.</p>
<h2>3. Statutory Compliance</h2>
<p>The Company shall comply with the Employees' Provident Funds and Miscellaneous Provisions Act, 1952, the Payment of Gratuity Act, 1972, and applicable state-specific Shops & Establishments Act.</p>
<h2>4. Confidentiality and IP</h2>
<p>Employee acknowledges that all work product developed during employment shall vest in the Company under the Copyright Act, 1957, and the Patents Act, 1970.</p>
<h2>5. Notice Period</h2>
<p>Either party may terminate employment by giving {{noticePeriod}} days' written notice or payment in lieu thereof.</p>
<h2>6. Non-Solicitation</h2>
<p>For a period of {{restrictionPeriod}} months following termination, Employee shall not solicit the Company's clients or employees.</p>
<h2>7. Jurisdiction</h2>
<p>Disputes shall be subject to the exclusive jurisdiction of the courts at {{city}}, India.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'real_estate_property',
    name: 'India Agreement to Sell (Residential Property)',
    documentKind: 'sale_agreement',
    sortOrder: 1,
    content: wrap(
      'Agreement to Sell (India)',
      'India',
      `<p>THIS AGREEMENT TO SELL is made at {{city}} on {{today}} between {{vendorName}} ("Vendor/Seller") and {{clientName}} ("Purchaser/Buyer").</p>
<h2>RECITALS</h2>
<p>The Vendor is the absolute owner of the property situated at {{propertyAddress}} bearing Survey/Plot No. {{plotNumber}}.</p>
<h2>1. Sale Consideration</h2>
<p>The total sale consideration is ₹{{propertyPrice}} (Rupees {{propertyPriceWords}} only). Token money of ₹{{depositAmount}} paid on this date; balance payable on registration.</p>
<h2>2. RERA Compliance</h2>
<p>This transaction is subject to the Real Estate (Regulation and Development) Act, 2016 and applicable state RERA rules.</p>
<h2>3. Encumbrances</h2>
<p>The Vendor declares the property is free from all encumbrances, charges, and litigation. Title documents shall be provided to the Purchaser for due diligence.</p>
<h2>4. Registration</h2>
<p>The Sale Deed shall be executed and registered at the Sub-Registrar's Office, {{registrarOffice}}, on or before {{completionDate}}. Stamp duty and registration charges shall be borne by the Purchaser.</p>
<h2>5. Possession</h2>
<p>Possession of the property shall be handed over to the Purchaser on {{possessionDate}}.</p>`,
    ),
  },
  // ── KENYA ──────────────────────────────────────────────────────────────────────
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    practiceArea: 'employment_labour',
    name: 'Kenya Employment Contract (Employment Act 2007)',
    documentKind: 'employment_contract',
    sortOrder: 1,
    content: wrap(
      'Contract of Employment (Kenya)',
      'Kenya',
      `<p>This Contract of Employment is made pursuant to the Employment Act, 2007 (Laws of Kenya) between {{employerName}} ("Employer") and {{clientName}} ("Employee").</p>
<h2>1. Appointment</h2>
<p>The Employee is engaged as {{jobTitle}} at {{workLocation}}, commencing {{startDate}}.</p>
<h2>2. Remuneration</h2>
<p>Monthly gross salary: KES {{salary}}. The Employer shall deduct PAYE, NHIF, and NSSF contributions as required by Kenyan law.</p>
<h2>3. Working Hours</h2>
<p>The normal working hours shall be {{workingHours}} hours per week in accordance with the Employment Act, 2007.</p>
<h2>4. Leave Entitlement</h2>
<p>Annual leave: 21 working days per year (after 12 months' service), as required by Section 28 of the Employment Act, 2007. Sick leave: 30 days on full pay, 15 days on half pay per leave cycle.</p>
<h2>5. Termination</h2>
<p>Either party may terminate this contract by giving {{noticePeriod}} days' written notice or salary in lieu, subject to the Employment Act, 2007. Summary dismissal may occur for gross misconduct as defined in Section 44 of the Act.</p>
<h2>6. Dispute Resolution</h2>
<p>Any dispute shall be referred to the Employment and Labour Relations Court of Kenya.</p>`,
    ),
  },
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    practiceArea: 'corporate_commercial',
    name: 'Kenya Company Incorporation Documents',
    documentKind: 'incorporation_documents',
    sortOrder: 1,
    content: wrap(
      'Company Incorporation Documents (Kenya)',
      'Kenya',
      `<p>Prepared for registration of {{companyName}} under the Companies Act, 2015 (Laws of Kenya).</p>
<h2>1. Company Type</h2>
<p>☐ Private Company Limited by Shares ☐ Public Company ☐ Company Limited by Guarantee</p>
<h2>2. Registered Office</h2>
<p>{{registeredAddress}}, Kenya</p>
<h2>3. Share Capital</h2>
<p>Authorized share capital: KES {{authorizedCapital}} divided into {{numberOfShares}} shares of KES {{parValue}} each.</p>
<h2>4. Directors</h2>
<p>Initial directors: {{directorDetails}}. Each director must meet requirements of Companies Act, 2015, Section 130.</p>
<h2>5. Memorandum & Articles</h2>
<p>The Company adopts Model Articles as provided under Companies Act, 2015, with the following modifications: {{modificationsToArticles}}</p>
<h2>6. Filing Requirements</h2>
<p>The incorporation documents shall be filed with the Registrar of Companies, State Law Office, Nairobi, accompanied by the prescribed fees.</p>`,
    ),
  },
  // ── GB — ENGLAND & WALES ──────────────────────────────────────────────────────
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'employment_labour',
    name: 'England & Wales Written Statement of Employment Particulars',
    documentKind: 'employment_contract',
    sortOrder: 1,
    content: wrap(
      'Written Statement of Employment Particulars (England & Wales)',
      'England & Wales',
      `<p>This document constitutes a Written Statement of Employment Particulars as required by the Employment Rights Act 1996 (as amended by the Employment Act 2002).</p>
<h2>1. Parties</h2>
<p>Employer: {{employerName}} | Employee: {{clientName}}</p>
<h2>2. Commencement</h2>
<p>Date of commencement of employment: {{startDate}}. Continuous employment began on {{continuousEmploymentDate}}.</p>
<h2>3. Job Title and Location</h2>
<p>Job Title: {{jobTitle}} | Place of work: {{workLocation}}</p>
<h2>4. Remuneration</h2>
<p>Basic salary: £{{salary}} per annum, paid {{payFrequency}}. The national minimum/living wage provisions apply in accordance with the National Minimum Wage Act 1998.</p>
<h2>5. Working Hours</h2>
<p>Normal working hours: {{workingHours}} hours per week, subject to the Working Time Regulations 1998.</p>
<h2>6. Holiday Entitlement</h2>
<p>{{annualLeave}} days per leave year (inclusive of public holidays), as required by the Working Time Regulations 1998.</p>
<h2>7. Sickness</h2>
<p>Statutory Sick Pay (SSP) applies in accordance with the Social Security Contributions and Benefits Act 1992. Company sick pay: {{companySickPay}}</p>
<h2>8. Notice</h2>
<p>Statutory minimum notice (Employment Rights Act 1996, s.86) applies. Additional contractual notice: {{additionalNotice}}</p>
<h2>9. Disciplinary and Grievance</h2>
<p>The Acas Code of Practice on Disciplinary and Grievance Procedures applies. Copies of the policies are available from HR.</p>
<h2>10. Pension</h2>
<p>Auto-enrolment pension provision applies under the Pensions Act 2008. Scheme provider: {{pensionProvider}}</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'real_estate_property',
    name: 'England & Wales Residential Lease (AST)',
    documentKind: 'lease_agreement',
    sortOrder: 1,
    content: wrap(
      'Assured Shorthold Tenancy Agreement (England & Wales)',
      'England & Wales',
      `<p>THIS TENANCY AGREEMENT is made pursuant to the Housing Act 1988 (as amended) between {{landlordName}} ("Landlord") and {{clientName}} ("Tenant").</p>
<h2>1. Property</h2>
<p>The Landlord lets to the Tenant the property at {{propertyAddress}} ("the Property").</p>
<h2>2. Term</h2>
<p>Fixed term of {{tenancyDuration}} months commencing {{startDate}} and ending {{endDate}}.</p>
<h2>3. Rent</h2>
<p>£{{monthlyRent}} per calendar month, payable in advance on the {{rentDayOfMonth}} of each month. The first payment of £{{firstPayment}} is due on {{startDate}}.</p>
<h2>4. Deposit</h2>
<p>Deposit of £{{depositAmount}} to be protected in a government-approved Tenancy Deposit Scheme within 30 days of receipt (Housing Act 2004, Part 6).</p>
<h2>5. Landlord's Obligations</h2>
<p>The Landlord shall comply with the Landlord and Tenant Act 1985 (s.11): maintain the structure, exterior, and installations for supply of water, gas, electricity, and sanitation.</p>
<h2>6. Energy Performance</h2>
<p>An Energy Performance Certificate (EPC) has been provided. The property's EPC rating is {{epcRating}}. Properties must achieve a minimum EPC rating of E under the Energy Efficiency (Private Rented Property) (England and Wales) Regulations 2015.</p>
<h2>7. Right to Rent</h2>
<p>The Landlord has conducted Right to Rent checks in accordance with the Immigration Act 2014.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'Scotland',
    practiceArea: 'real_estate_property',
    name: 'Scotland Private Residential Tenancy Agreement',
    documentKind: 'lease_agreement',
    sortOrder: 2,
    content: wrap(
      'Private Residential Tenancy Agreement (Scotland)',
      'Scotland',
      `<p>This Private Residential Tenancy is created under the Private Housing (Tenancies) (Scotland) Act 2016 between {{landlordName}} ("Landlord") and {{clientName}} ("Tenant").</p>
<h2>1. Property</h2>
<p>{{propertyAddress}}</p>
<h2>2. Tenancy Type</h2>
<p>This is an open-ended Private Residential Tenancy (no fixed term), as required by the 2016 Act. The tenancy will not automatically end — the Tenant must give 28 days' notice.</p>
<h2>3. Rent</h2>
<p>£{{monthlyRent}} per calendar month. Rent increases must follow the Rent Adjudication process under the 2016 Act.</p>
<h2>4. Deposit</h2>
<p>Deposit of £{{depositAmount}} protected with an approved Tenancy Deposit Scheme (Housing (Scotland) Act 2006).</p>
<h2>5. Mandatory Clauses</h2>
<p>This tenancy incorporates all mandatory clauses as prescribed by the Private Residential Tenancy (Statutory Terms) (Scotland) Regulations 2017.</p>`,
    ),
  },
  // ── US — TEXAS ────────────────────────────────────────────────────────────────
  {
    countryCode: 'US',
    jurisdiction: 'Texas',
    practiceArea: 'employment_labour',
    name: 'Texas At-Will Employment Agreement',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'Texas Employment Agreement',
      'Texas, USA',
      `<p>Employment at-will under Texas law between {{employerName}} and {{clientName}} effective {{startDate}}.</p>
<h2>1. Position</h2><p>{{jobTitle}} — duties as assigned.</p>
<h2>2. Compensation</h2><p>Salary: {{salary}} per year. FLSA overtime rules apply to non-exempt employees.</p>
<h2>3. Non-Compete</h2><p>Any non-compete must comply with Texas Business & Commerce Code Chapter 15 (reasonable scope, duration, geography).</p>
<h2>4. Governing Law</h2><p>Texas law and courts of {{county}} County, Texas.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'Florida',
    practiceArea: 'real_estate_property',
    name: 'Florida Residential Contract for Sale',
    documentKind: 'sale_agreement',
    sortOrder: 2,
    content: wrap(
      'Florida Residential Sale Contract',
      'Florida, USA',
      `<p>Contract between {{vendorName}} (Seller) and {{clientName}} (Buyer) for {{propertyAddress}}.</p>
<h2>1. Price</h2><p>{{propertyPrice}} with deposit {{depositAmount}}.</p>
<h2>2. Florida Disclosures</h2><p>Seller shall provide lead-based paint (pre-1978), HOA/condo estoppel, and property tax disclosures per Florida Statutes Chapter 475 and 718/720.</p>
<h2>3. Closing</h2><p>Closing on {{completionDate}}; documentary stamp tax and surtax apply per Florida law.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'Federal',
    practiceArea: 'corporate_commercial',
    name: 'US Federal Contractor Service Agreement',
    documentKind: 'service_agreement',
    sortOrder: 3,
    content: wrap(
      'Federal Contractor Service Agreement',
      'United States (Federal)',
      `<p>Between {{party1Name}} (Agency/Client) and {{party2Name}} (Contractor).</p>
<h2>1. Services</h2><p>{{servicesDescription}}</p>
<h2>2. Compliance</h2><p>Contractor shall comply with applicable FAR clauses, E-Verify if required, and federal anti-discrimination laws.</p>
<h2>3. IP</h2><p>Work product may be subject to Bayh-Dole or agency-specific IP clauses — confirm with contracting officer.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'California',
    practiceArea: 'corporate_commercial',
    name: 'California Mutual NDA',
    documentKind: 'nda',
    sortOrder: 2,
    content: wrap(
      'California Mutual NDA',
      'California, USA',
      `<p>Mutual NDA between {{party1Name}} and {{party2Name}} governed by California law and CCPA/CPRA for personal information.</p>
<h2>1. Confidential Information</h2><p>Broad definition covering business, technical, and financial information.</p>
<h2>2. Term</h2><p>{{ndaDurationYears}} years from Effective Date.</p>`,
    ),
  },
  // ── INDIA — STATES ────────────────────────────────────────────────────────────
  {
    countryCode: 'IN',
    jurisdiction: 'Maharashtra',
    practiceArea: 'real_estate_property',
    name: 'Maharashtra Agreement to Sell (Stamp Duty)',
    documentKind: 'sale_agreement',
    sortOrder: 2,
    content: wrap(
      'Maharashtra Agreement to Sell',
      'Maharashtra, India',
      `<p>Agreement to sell property at {{propertyAddress}} in Maharashtra.</p>
<h2>1. Stamp Duty</h2><p>Stamp duty per Maharashtra Stamp Act and e-registration via IGR Maharashtra.</p>
<h2>2. RERA</h2><p>If project premises, Maharashtra RERA registration of promoter/project applies.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'Karnataka',
    practiceArea: 'real_estate_property',
    name: 'Karnataka Sale Agreement',
    documentKind: 'sale_agreement',
    sortOrder: 3,
    content: wrap(
      'Karnataka Sale Agreement',
      'Karnataka, India',
      `<p>Agreement for sale of {{propertyAddress}} in Karnataka.</p>
<h2>1. Registration</h2><p>Compulsory registration under Registration Act, 1908 via Kaveri/online stamp portal.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'Delhi',
    practiceArea: 'employment_labour',
    name: 'Delhi Shops & Establishments Employment Contract',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'Delhi Employment Contract',
      'Delhi, India',
      `<p>Employment contract subject to Delhi Shops & Establishments Act, 1954.</p>
<h2>1. Hours & Leave</h2><p>Working hours, weekly offs, and leave per Delhi rules and applicable labour codes.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'corporate_commercial',
    name: 'India Service Agreement (IT/ITES)',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'India IT/ITES Service Agreement',
      'India',
      `<p>Service agreement between {{party1Name}} and {{party2Name}} for {{servicesDescription}}.</p>
<h2>1. GST</h2><p>Invoices shall include GST as applicable; place of supply per IGST Act.</p>
<h2>2. DPDP Act 2023</h2><p>Personal data processing per Digital Personal Data Protection Act, 2023.</p>
<h2>3. Dispute Resolution</h2><p>Arbitration under Arbitration and Conciliation Act, 1996 — seat {{city}}, India.</p>`,
    ),
  },
  // ── KENYA — NAIROBI ─────────────────────────────────────────────────────────
  {
    countryCode: 'KE',
    jurisdiction: 'Nairobi',
    practiceArea: 'real_estate_property',
    name: 'Nairobi Lease Agreement',
    documentKind: 'lease_agreement',
    sortOrder: 2,
    content: wrap(
      'Nairobi Lease Agreement',
      'Nairobi, Kenya',
      `<p>Lease of {{propertyAddress}} between {{landlordName}} and {{clientName}}.</p>
<h2>1. Rent Control</h2><p>Check applicability of rent restriction laws for protected tenancies in Nairobi.</p>
<h2>2. Registration</h2><p>Long leases may require registration under Land Registration Act, 2012.</p>`,
    ),
  },
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    practiceArea: 'corporate_commercial',
    name: 'Kenya Service Agreement',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'Kenya Service Agreement',
      'Kenya',
      `<p>Services agreement governed by Law of Contract Act (Cap 23).</p>
<h2>1. Withholding Tax</h2><p>WHT may apply to professional/management fees per Income Tax Act.</p>`,
    ),
  },
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    practiceArea: 'intellectual_property',
    name: 'Kenya NDA',
    documentKind: 'nda',
    sortOrder: 1,
    content: wrap(
      'Kenya Confidentiality Agreement',
      'Kenya',
      `<p>NDA between {{party1Name}} and {{party2Name}}. Data processing per Data Protection Act, 2019.</p>`,
    ),
  },
  // ── GB — ADDITIONAL ───────────────────────────────────────────────────────────
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'corporate_commercial',
    name: 'England & Wales Service Agreement',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'England & Wales Service Agreement',
      'England & Wales',
      `<p>Services agreement between {{party1Name}} and {{party2Name}} for {{servicesDescription}}.</p>
<h2>1. IR35</h2><p>If contractor individual via intermediary, off-payroll working rules may apply.</p>
<h2>2. Governing Law</h2><p>Laws of England and Wales; courts of England and Wales.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'Scotland',
    practiceArea: 'employment_labour',
    name: 'Scotland Contract of Employment',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'Scotland Employment Contract',
      'Scotland',
      `<p>Contract of employment subject to UK employment rights and Scots common law/civil procedure for disputes.</p>
<h2>1. Jurisdiction</h2><p>Employment Tribunal (Scotland) for statutory claims.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'Northern Ireland',
    practiceArea: 'employment_labour',
    name: 'Northern Ireland Contract of Employment',
    documentKind: 'employment_contract',
    sortOrder: 3,
    content: wrap(
      'Northern Ireland Employment Contract',
      'Northern Ireland',
      `<p>Employment contract subject to Employment Rights (Northern Ireland) Order 1996 and local tribunal procedure.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'wills_estates_probate',
    name: 'England & Wales Will Template',
    documentKind: 'last_will_testament',
    sortOrder: 1,
    content: wrap(
      'Last Will and Testament (England & Wales)',
      'England & Wales',
      `<p>Will of {{clientName}} executed per Wills Act 1837 — two witnesses present simultaneously.</p>
<h2>1. Executors</h2><p>{{executorNames}}</p>
<h2>2. Residuary Estate</h2><p>To {{primaryBeneficiary}}</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'New York',
    practiceArea: 'employment_labour',
    name: 'New York Employment Agreement',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'New York Employment Agreement',
      'New York, USA',
      `<p>Employment agreement subject to NY Human Rights Law, NY Wage Theft Prevention Act notice requirements, and applicable NYC local laws if NYC-based.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'Texas',
    practiceArea: 'corporate_commercial',
    name: 'Texas LLC Operating Agreement',
    documentKind: 'llc_operating_agreement',
    sortOrder: 1,
    content: wrap(
      'Texas LLC Operating Agreement',
      'Texas, USA',
      `<p>Operating Agreement of {{companyName}}, a Texas LLC under Texas Business Organizations Code.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'intellectual_property',
    name: 'India NDA (DPDP Compliant)',
    documentKind: 'nda',
    sortOrder: 1,
    content: wrap(
      'India Mutual NDA',
      'India',
      `<p>Mutual confidentiality agreement with personal data obligations under DPDP Act, 2023.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'Maharashtra',
    practiceArea: 'corporate_commercial',
    name: 'Maharashtra Partnership Deed',
    documentKind: 'partnership_agreement',
    sortOrder: 1,
    content: wrap(
      'Maharashtra Partnership Deed',
      'Maharashtra, India',
      `<p>Partnership deed under Indian Partnership Act, 1932 — registration with Registrar of Firms, Maharashtra recommended.</p>`,
    ),
  },
  // ── Expanded contract library (employment, contractor, construction) ──
  {
    countryCode: 'US',
    jurisdiction: 'Federal',
    practiceArea: 'employment_labour',
    name: 'US Independent Contractor Agreement',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'Independent Contractor Agreement',
      'United States',
      `<h2>1. Services</h2><p>Contractor shall perform: {{servicesDescription}}.</p>
<h2>2. Independent Contractor Status</h2><p>Contractor is an independent contractor, not an employee. Contractor is responsible for taxes, benefits, and compliance with applicable IRS classification rules.</p>
<h2>3. Compensation</h2><p>Fee: {{contractValue}} payable {{paymentTerms}}.</p>
<h2>4. Term</h2><p>From {{contractStartDate}} until {{contractEndDate}} unless terminated earlier.</p>
<h2>5. IP Assignment</h2><p>Work product shall be assigned to {{clientName}} as specified in applicable law.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'Federal',
    practiceArea: 'corporate_commercial',
    name: 'US Construction Subcontractor Agreement',
    documentKind: 'construction_contract',
    sortOrder: 2,
    content: wrap(
      'Construction Subcontractor Agreement',
      'United States',
      `<h2>1. Project</h2><p>Subcontractor performs work at {{propertyAddress}} for {{employerName}}.</p>
<h2>2. Scope</h2><p>{{servicesDescription}}</p>
<h2>3. Price &amp; Payment</h2><p>Contract sum {{contractValue}}; progress payments per schedule.</p>
<h2>4. Safety &amp; Compliance</h2><p>Subcontractor complies with OSHA, local building codes, and lien waiver requirements.</p>
<h2>5. Indemnity &amp; Insurance</h2><p>Subcontractor maintains general liability and workers compensation coverage.</p>`,
    ),
  },
  {
    countryCode: 'US',
    jurisdiction: 'Federal',
    practiceArea: 'employment_labour',
    name: 'US Job Offer Letter',
    documentKind: 'offer_letter',
    sortOrder: 2,
    content: wrap(
      'Employment Offer Letter',
      'United States',
      `<p>Dear {{clientName}},</p>
<p>We are pleased to offer you the position of {{jobTitle}} at {{employerName}}, reporting to {{party2Name}}.</p>
<p>Start date: {{contractStartDate}}. Compensation: {{salary}} {{payFrequency}}.</p>
<p>This offer is contingent on satisfactory background checks and proof of work authorization.</p>
<p>Employment is at-will unless otherwise stated in a separate written agreement.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'employment_labour',
    name: 'India Employment Agreement',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'India Employment Agreement',
      'India',
      `<h2>1. Appointment</h2><p>{{clientName}} is appointed as {{jobTitle}} with {{employerName}} effective {{contractStartDate}}.</p>
<h2>2. Compensation</h2><p>CTC {{salary}} with statutory PF/ESI as applicable under Indian labour laws.</p>
<h2>3. Confidentiality</h2><p>Employee shall protect confidential information and comply with DPDP Act obligations where personal data is processed.</p>
<h2>4. Termination</h2><p>Notice period {{noticePeriod}} subject to applicable Shops &amp; Establishments / ID Act requirements.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'corporate_commercial',
    name: 'India Independent Contractor Agreement',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'India Consultant / Contractor Agreement',
      'India',
      `<h2>1. Services</h2><p>{{party2Name}} shall provide {{servicesDescription}} to {{clientName}}.</p>
<h2>2. Fees &amp; GST</h2><p>Professional fees {{contractValue}} plus applicable GST; invoices payable {{paymentTerms}}.</p>
<h2>3. Non-employee status</h2><p>Consultant is not an employee; responsible for own taxes and statutory registrations.</p>
<h2>4. IP &amp; Confidentiality</h2><p>Deliverables assigned to {{clientName}}; mutual confidentiality obligations apply.</p>`,
    ),
  },
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    practiceArea: 'real_estate_property',
    name: 'India Construction Agreement',
    documentKind: 'construction_contract',
    sortOrder: 2,
    content: wrap(
      'India Construction Work Agreement',
      'India',
      `<h2>1. Works</h2><p>Contractor shall execute construction at {{propertyAddress}} per approved drawings.</p>
<h2>2. Contract Price</h2><p>Lump sum {{contractValue}} with milestone-based payments.</p>
<h2>3. Time</h2><p>Completion by {{contractEndDate}}; liquidated damages for delay as agreed.</p>
<h2>4. Statutory compliance</h2><p>Contractor complies with RERA (if applicable), labour laws, and safety norms.</p>`,
    ),
  },
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    practiceArea: 'employment_labour',
    name: 'Kenya Employment Contract',
    documentKind: 'employment_contract',
    sortOrder: 2,
    content: wrap(
      'Kenya Employment Contract',
      'Kenya',
      `<p>Employment contract under Employment Act, 2007 between {{employerName}} and {{clientName}} for role {{jobTitle}}.</p>
<p>Remuneration {{salary}}; leave and termination per statutory minimums.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'corporate_commercial',
    name: 'UK Consultancy Agreement',
    documentKind: 'service_agreement',
    sortOrder: 2,
    content: wrap(
      'UK Consultancy Services Agreement',
      'England & Wales',
      `<p>Consultancy agreement between {{clientName}} and {{party2Name}} for {{servicesDescription}}.</p>
<p>Fees {{contractValue}}; IR35 / off-payroll considerations to be assessed separately.</p>`,
    ),
  },
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    practiceArea: 'real_estate_property',
    name: 'UK Building Contract (Short Form)',
    documentKind: 'construction_contract',
    sortOrder: 2,
    content: wrap(
      'Building Contract (Short Form)',
      'England & Wales',
      `<p>JCT-style short form building contract for works at {{propertyAddress}}.</p>
<p>Contract sum {{contractValue}}; practical completion by {{contractEndDate}}.</p>`,
    ),
  },
];
