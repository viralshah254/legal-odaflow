/**
 * Curated legal-forms reference rows (USCIS, IRS, CA JC, NY UCS, federal court, etc.)
 * Merged into full catalog by ingest-legal-forms-full-catalog.js
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;

function readJson(name) {
  const file = path.join(DIR, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

const USCIS_FORMS = [
  ['I-130', 'Petition for Alien Relative'], ['I-485', 'Application to Register Permanent Residence'],
  ['I-765', 'Application for Employment Authorization'], ['I-129', 'Petition for Nonimmigrant Worker'],
  ['I-140', 'Immigrant Petition for Alien Worker'], ['I-539', 'Application to Extend/Change Nonimmigrant Status'],
  ['I-751', 'Petition to Remove Conditions on Residence'], ['I-90', 'Application to Replace Permanent Resident Card'],
  ['I-824', 'Application for Action on Approved Application'], ['I-864', 'Affidavit of Support Under Section 213A'],
  ['I-912', 'Request for Fee Waiver'], ['I-131', 'Application for Travel Document'],
  ['I-821', 'Application for Temporary Protected Status'], ['N-400', 'Application for Naturalization'],
  ['I-589', 'Application for Asylum and Withholding of Removal'], ['I-601', 'Application for Waiver of Grounds of Inadmissibility'],
  ['I-693', 'Report of Medical Examination and Vaccination Record'], ['I-129F', 'Petition for Alien Fiancé(e)'],
  ['I-360', 'Petition for Amerasian, Widow(er), or Special Immigrant'], ['I-526', 'Immigrant Petition by Standalone Investor'],
  ['I-526E', 'Immigrant Petition by Regional Center Investor'], ['I-829', 'Petition by Investor to Remove Conditions'],
  ['I-918', 'Petition for U Nonimmigrant Status'], ['I-918A', 'Petition for Qualifying Family Member of U-1'],
  ['I-914', 'Application for T Nonimmigrant Status'], ['I-914A', 'Application for Derivative T Nonimmigrant Status'],
  ['I-102', 'Application for Replacement/Initial Nonimmigrant Arrival-Departure Document'],
  ['I-212', 'Application for Permission to Reapply for Admission'], ['I-290B', 'Notice of Appeal or Motion'],
  ['I-407', 'Record of Abandonment of Lawful Permanent Resident Status'], ['I-485J', 'Confirmation of Bona Fide Job Offer'],
  ['I-600', 'Petition to Classify Orphan as Immediate Relative'], ['I-600A', 'Application for Advance Processing of Orphan Petition'],
  ['I-800', 'Petition to Classify Convention Adoptee'], ['I-800A', 'Application for Determination of Suitability to Adopt'],
  ['I-907', 'Request for Premium Processing Service'], ['I-941', 'Application for Entrepreneur Parole'],
  ['N-565', 'Application for Replacement Naturalization/Citizenship Document'], ['N-600', 'Application for Certificate of Citizenship'],
  ['N-648', 'Medical Certification for Disability Exceptions'], ['I-765V', 'Application for EAD for Abused Nonimmigrant Spouse'],
  ['I-956', 'Application for Regional Center Designation'], ['I-956F', 'Application for Approval of an Investment in a Commercial Enterprise'],
];

const IRS_FORMS = [
  ['1040', 'U.S. Individual Income Tax Return'], ['1040-SR', 'U.S. Tax Return for Seniors'],
  ['1040-X', 'Amended U.S. Individual Income Tax Return'], ['1040-ES', 'Estimated Tax for Individuals'],
  ['Schedule A', 'Itemized Deductions'], ['Schedule B', 'Interest and Ordinary Dividends'],
  ['Schedule C', 'Profit or Loss From Business'], ['Schedule D', 'Capital Gains and Losses'],
  ['Schedule E', 'Supplemental Income and Loss'], ['Schedule SE', 'Self-Employment Tax'],
  ['W-4', 'Employee Withholding Certificate'], ['W-9', 'Request for Taxpayer Identification Number'],
  ['W-2', 'Wage and Tax Statement'], ['1120', 'U.S. Corporation Income Tax Return'],
  ['1120-S', 'U.S. Income Tax Return for an S Corporation'], ['1065', 'U.S. Return of Partnership Income'],
  ['1120-F', 'U.S. Income Tax Return of a Foreign Corporation'], ['990', 'Return of Organization Exempt From Income Tax'],
  ['941', 'Employer Quarterly Federal Tax Return'], ['940', 'Employer Annual Federal Unemployment Tax Return'],
  ['1099-NEC', 'Nonemployee Compensation'], ['1099-MISC', 'Miscellaneous Information'],
  ['1099-INT', 'Interest Income'], ['1099-DIV', 'Dividends and Distributions'],
  ['1099-R', 'Distributions From Pensions'], ['2848', 'Power of Attorney and Declaration of Representative'],
  ['433-A', 'Collection Information Statement for Wage Earners'], ['433-B', 'Collection Information Statement for Businesses'],
  ['9465', 'Installment Agreement Request'], ['4506-T', 'Request for Transcript of Tax Return'],
  ['8822', 'Change of Address'], ['8862', 'Information To Claim Earned Income Credit After Disallowance'],
  ['2553', 'Election by a Small Business Corporation'], ['8832', 'Entity Classification Election'],
  ['4562', 'Depreciation and Amortization'], ['4797', 'Sales of Business Property'],
  ['8949', 'Sales and Other Dispositions of Capital Assets'], ['6251', 'Alternative Minimum Tax—Individuals'],
  ['8606', 'Nondeductible IRAs'], ['8889', 'Health Savings Accounts'], ['8962', 'Premium Tax Credit'],
  ['8995', 'Qualified Business Income Deduction Simplified Computation'],
];

const TX_FORMS = [
  ['OCA-001', 'Original Petition (Family)', 'Family'], ['OCA-002', 'Original Answer (Family)', 'Family'],
  ['OCA-010', 'Motion for Temporary Orders', 'Family'], ['OCA-020', 'Final Decree of Divorce', 'Family'],
  ['OCA-090', 'Forcible Detainer Petition', 'Real Estate'], ['OCA-110', 'Small Claims Petition', 'Civil'],
  ['OCA-150', 'Probate Application', 'Probate'], ['OCA-190', 'Motion for Summary Judgment', 'Civil'],
  ['OCA-240', 'Notice of Appeal', 'Civil'], ['OCA-260', 'Habeas Corpus Application', 'Criminal'],
];

const STATE_AUTHORITY = {
  TX: ['Texas', 'Texas Courts', 'https://www.txcourts.gov'],
  FL: ['Florida', 'Florida Courts E-Filing Portal', 'https://www.flcourts.org'],
  IL: ['Illinois', 'Illinois Courts', 'https://www.illinoiscourts.gov'],
};

const GB_FORMS = [
  ['N1', 'Claim Form (CPR Part 7)', 'litigation', 'Civil Procedure Rules'],
  ['N208', 'Application Notice', 'litigation', 'Civil Procedure Rules'],
  ['N244', 'Application for Interim Order', 'litigation', 'Civil Procedure Rules'],
  ['N265', 'Particulars of Claim', 'litigation', 'Civil Procedure Rules'],
  ['N279', 'Notice of Discontinuance', 'litigation', 'Civil Procedure Rules'],
  ['N323', 'Notice of Change of Solicitor', 'litigation', 'Civil Procedure Rules'],
  ['N510', 'Notice of Appeal', 'litigation', 'Civil Procedure Rules'],
  ['C100', 'Application for Child Arrangements Order', 'family_matrimonial', 'Family Procedure Rules'],
  ['C1A', 'Allegations of Harm and Domestic Violence', 'family_matrimonial', 'Family Procedure Rules'],
  ['C7', 'Application for Financial Order', 'family_matrimonial', 'Family Procedure Rules'],
  ['PA1', 'Probate Application', 'probate_estates', 'HM Courts & Tribunals Service'],
  ['IHT400', 'Inheritance Tax Account', 'tax', 'HM Revenue & Customs'],
  ['FL401', 'Application for Non-Molestation Order', 'family_matrimonial', 'Family Procedure Rules'],
  ['FL404', 'Application to Vary/Discharge Non-Molestation Order', 'family_matrimonial', 'Family Procedure Rules'],
  ['PC1', 'Petition for Divorce/Dissolution', 'family_matrimonial', 'HM Courts & Tribunals Service'],
  ['Form E', 'Financial Statement', 'family_matrimonial', 'Family Procedure Rules'],
  ['LR1', 'Land Registry Application', 'real_estate_property', 'HM Land Registry'],
  ['AP1', 'Application to Register Title', 'real_estate_property', 'HM Land Registry'],
  ['TR1', 'Transfer of Whole of Registered Title', 'real_estate_property', 'HM Land Registry'],
  ['DS1', 'Discharge of Charge', 'real_estate_property', 'HM Land Registry'],
  ['CH1', 'Application for Registration of Charge', 'real_estate_property', 'HM Land Registry'],
  ['N244A', 'Witness Statement in Support', 'litigation', 'Civil Procedure Rules'],
  ['N161', 'Notice of Part Admission', 'litigation', 'Civil Procedure Rules'],
  ['N225', 'Particulars of Just and Equitable Accounting', 'litigation', 'Civil Procedure Rules'],
  ['N260', 'Statement of Costs (Summary Assessment)', 'litigation', 'Civil Procedure Rules'],
  ['N263', 'Certificate of Costs (Detailed Assessment)', 'litigation', 'Civil Procedure Rules'],
  ['N271', 'List of Documents', 'litigation', 'Civil Procedure Rules'],
];

const KE_FORMS = [
  ['CMCC-001', 'Civil Suit Plaint', 'litigation', 'Kenya Judiciary'],
  ['CMCC-002', 'Written Statement of Defence', 'litigation', 'Kenya Judiciary'],
  ['CMCC-003', 'Notice of Motion', 'litigation', 'Kenya Judiciary'],
  ['CMCC-004', 'Affidavit in Support', 'litigation', 'Kenya Judiciary'],
  ['CMCC-005', 'Notice of Appeal', 'litigation', 'Kenya Court of Appeal'],
  ['FAM-001', 'Divorce Petition', 'family_matrimonial', 'Kenya Judiciary'],
  ['FAM-002', 'Children Act Application', 'family_matrimonial', 'Kenya Judiciary'],
  ['FAM-003', 'Maintenance Application', 'family_matrimonial', 'Kenya Judiciary'],
  ['CRIM-001', 'Bail Application', 'criminal', 'Kenya Judiciary'],
  ['CRIM-002', 'Petition for Review', 'criminal', 'Kenya High Court'],
  ['PROB-001', 'Probate Petition', 'probate_estates', 'Kenya Judiciary'],
  ['PROB-002', 'Letters of Administration Application', 'probate_estates', 'Kenya Judiciary'],
  ['LAND-001', 'Land Reference Application', 'real_estate_property', 'Environment and Land Court'],
  ['LAND-002', 'Eviction Application', 'real_estate_property', 'Environment and Land Court'],
  ['EMP-001', 'Employment Cause', 'employment', 'Employment and Labour Relations Court'],
  ['EMP-002', 'Judicial Review Application', 'administrative', 'Kenya High Court'],
  ['TAX-001', 'Tax Appeal', 'tax', 'Tax Appeals Tribunal'],
  ['TAX-002', 'VAT Refund Application', 'tax', 'Kenya Revenue Authority'],
  ['CO-001', 'Company Petition (Insolvency)', 'corporate_commercial', 'High Court Commercial Division'],
  ['CO-002', 'Petition for Winding Up', 'corporate_commercial', 'High Court Commercial Division'],
  ['CON-001', 'Consumer Complaint', 'litigation', 'Competition Authority of Kenya'],
  ['CON-002', 'Constitutional Petition', 'constitutional', 'Kenya High Court'],
  ['ARB-001', 'Arbitration Application', 'litigation', 'Kenya Judiciary'],
  ['ADM-001', 'Judicial Review (Certiorari)', 'administrative', 'Kenya High Court'],
  ['ADM-002', 'Mandamus Application', 'administrative', 'Kenya High Court'],
  ['ADM-003', 'Habeas Corpus Application', 'criminal', 'Kenya High Court'],
];

function base(countryCode, extra = {}) {
  return { countryCode, isSystem: true, ...extra };
}

function loadUscisIrs() {
  const out = [];
  for (const [formNum, title] of USCIS_FORMS) {
    out.push(base('US', {
      practiceArea: 'immigration',
      formName: title,
      formNumber: formNum,
      authority: 'USCIS',
      sourceUrl: 'https://www.uscis.gov/forms',
      category: 'Immigration',
      description: `USCIS ${formNum}`,
    }));
  }
  for (const [formNum, title] of IRS_FORMS) {
    out.push(base('US', {
      practiceArea: 'tax',
      formName: title,
      formNumber: formNum,
      authority: 'IRS',
      sourceUrl: 'https://www.irs.gov/forms-instructions',
      category: 'Tax',
      description: `IRS Form ${formNum}`,
    }));
  }
  return out;
}

function loadCaJc() {
  const rows = readJson('us-ca-judicial-council.json') ?? [];
  return rows.map((f) => base('US', {
    jurisdiction: 'CA',
    practiceArea: 'litigation',
    formName: f.title,
    formNumber: f.formCode,
    authority: 'California Judicial Council',
    sourceUrl: 'https://www.courts.ca.gov/forms.htm',
    category: f.category || 'Civil',
    description: f.title,
  }));
}

function loadNyUcs() {
  const rows = readJson('us-ny-ucs-forms.json') ?? [];
  return rows.map((f) => base('US', {
    jurisdiction: 'NY',
    practiceArea: 'litigation',
    formName: f.title,
    formNumber: f.formCode,
    authority: 'NY Unified Court System',
    sourceUrl: 'https://www.nycourts.gov/forms/',
    category: f.category || 'Civil',
    description: f.title,
  }));
}

function loadFederalCourt() {
  const rows = readJson('us-federal-court-forms.json') ?? [];
  return rows.map(([num, name, category]) => base('US', {
    practiceArea: category === 'Bankruptcy' ? 'bankruptcy' : category === 'Criminal' ? 'criminal' : 'litigation',
    formName: name,
    formNumber: num,
    authority: 'U.S. Courts / AO Forms',
    sourceUrl: 'https://www.uscourts.gov/forms',
    category,
    description: `Federal court form ${num}: ${name}`,
  }));
}

function loadIndiaReference() {
  const rows = readJson('india-legal-forms-reference.json') ?? [];
  return rows.map(([num, name, area, auth]) => base('IN', {
    jurisdiction: undefined,
    practiceArea: area,
    formName: name,
    formNumber: num,
    authority: auth,
    sourceUrl: 'https://www.india.gov.in',
    category: area,
    description: `India official filing: ${name}`,
  }));
}

function loadTop5Named() {
  const rows = readJson('us-top5-named-forms.json') ?? [];
  const authorityByState = {
    CA: 'California Judicial Council',
    NY: 'NY Unified Court System',
    TX: 'Texas Courts',
    FL: 'Florida Courts E-Filing Portal',
    IL: 'Illinois Courts',
  };
  const urlByState = {
    CA: 'https://www.courts.ca.gov/forms.htm',
    NY: 'https://www.nycourts.gov/forms/',
    TX: 'https://www.txcourts.gov',
    FL: 'https://www.flcourts.org',
    IL: 'https://www.illinoiscourts.gov',
  };
  return rows.map((f) => base('US', {
    jurisdiction: f.boundState,
    practiceArea: 'litigation',
    formName: f.label,
    formNumber: f.formNumber,
    authority: authorityByState[f.boundState] ?? `${f.boundState} Courts`,
    sourceUrl: urlByState[f.boundState] ?? 'https://www.uscourts.gov/forms',
    category: f.category || 'Civil',
    description: f.subtitle ? `${f.label} — ${f.subtitle}` : f.label,
  }));
}

function loadStateOfficial(stateCode, forms, prefix) {
  const [stateName, authority, sourceUrl] = STATE_AUTHORITY[stateCode];
  return forms.map(([num, name, cat]) => base('US', {
    jurisdiction: stateCode,
    practiceArea: 'litigation',
    formName: name,
    formNumber: num.replace('OCA', prefix),
    authority,
    sourceUrl,
    category: cat,
    description: `${stateName} official form ${num.replace('OCA', prefix)}`,
  }));
}

function loadInternational() {
  const out = [];
  for (const [num, name, area, auth] of GB_FORMS) {
    out.push(base('GB', {
      practiceArea: area,
      formName: name,
      formNumber: num,
      authority: auth,
      sourceUrl: 'https://www.gov.uk/government/collections/court-forms',
      category: area,
      description: `UK court form ${num}`,
    }));
  }
  for (const [num, name, area, auth] of KE_FORMS) {
    out.push(base('KE', {
      practiceArea: area,
      formName: name,
      formNumber: num,
      authority: auth,
      sourceUrl: 'https://www.judiciary.go.ke',
      category: area,
      description: `Kenya court form ${num}`,
    }));
  }
  return out;
}

function loadAllSupplementalEntries() {
  return [
    ...loadUscisIrs(),
    ...loadCaJc(),
    ...loadNyUcs(),
    ...loadFederalCourt(),
    ...loadIndiaReference(),
    ...loadTop5Named(),
    ...loadStateOfficial('TX', TX_FORMS, 'OCA'),
    ...loadStateOfficial('FL', TX_FORMS, 'FLA'),
    ...loadStateOfficial('IL', TX_FORMS, 'ILC'),
    ...loadInternational(),
  ];
}

module.exports = { loadAllSupplementalEntries };
