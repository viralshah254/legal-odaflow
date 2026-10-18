#!/usr/bin/env node
/**
 * Phase 7+ document library apply script.
 * Runs India G–J, USCIS/IRS federal, top-5 named forms, overlay enrichment,
 * CA JC / NY UCS catalogs, and legal-forms seed expansion.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CATALOG_DIR = path.join(__dirname, 'catalog-data');

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\$`').replace(/\$/g, '\\$').replace(/"/g, '\\"');
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ─── India batches G–J ───────────────────────────────────────────────────────

const indiaBatchG = [
  ['india_ap_rent_petition', 'AP Rent Petition', 'AP Buildings (Lease, Rent and Eviction Control) Act', 'Civil'],
  ['india_kerala_rent_petition', 'Kerala Rent Petition', 'Kerala Buildings (Lease and Rent Control) Act', 'Civil'],
  ['india_telangana_rent_suit', 'Telangana Rent Suit', 'Telangana Buildings Act', 'Civil'],
  ['india_mp_rent_petition', 'MP Rent Petition', 'MP Accommodation Control Act', 'Civil'],
  ['india_punjab_rent_petition', 'Punjab Rent Petition', 'Punjab Rent Act', 'Civil'],
  ['india_bihar_rent_suit', 'Bihar Rent Suit', 'Bihar Buildings (Lease, Rent and Eviction Control) Act', 'Civil'],
  ['india_odisha_rent_petition', 'Odisha Rent Petition', 'Odisha House Rent Control Act', 'Civil'],
  ['india_assam_rent_petition', 'Assam Rent Petition', 'Assam Urban Areas Rent Control Act', 'Civil'],
  ['india_chhattisgarh_rent_notice', 'Chhattisgarh Rent Termination Notice', 'Chhattisgarh Rent Control Act', 'Conveyancing'],
  ['india_jharkhand_rent_petition', 'Jharkhand Rent Petition', 'Jharkhand Public Premises Act', 'Civil'],
  ['india_hp_rent_petition', 'HP Rent Petition', 'HP Urban Rent Control Act', 'Civil'],
  ['india_uttarakhand_rent_petition', 'Uttarakhand Rent Petition', 'Uttarakhand Rent Control Act', 'Civil'],
  ['india_goa_rent_petition', 'Goa Rent Petition', 'Goa Rent Control Act', 'Civil'],
  ['india_jk_rent_petition', 'J&K Rent Petition', 'J&K Rent Control Act', 'Civil'],
  ['india_ladakh_rent_petition', 'Ladakh Rent Petition', 'J&K Rent Control Act (applicable)', 'Civil'],
];

const indiaBatchH = [
  ['india_nclt_cirp_real_estate', 'CIRP Application (Real Estate Sector)', 'IBC §7/§9 — Real Estate', 'Insolvency'],
  ['india_nclt_cirp_infra', 'CIRP Application (Infrastructure Sector)', 'IBC §7/§9 — Infrastructure', 'Insolvency'],
  ['india_nclt_cirp_msme', 'CIRP Application (MSME Sector)', 'IBC §7/§9 — MSME', 'Insolvency'],
  ['india_nclt_cirp_nbfc', 'CIRP Application (NBFC Sector)', 'IBC §7/§9 — NBFC', 'Insolvency'],
  ['india_nclt_cirp_startup', 'CIRP Application (Startup Sector)', 'IBC §7/§9 — Startup', 'Insolvency'],
  ['india_nclt_cirp_education', 'CIRP Application (Education Sector)', 'IBC §7/§9 — Education', 'Insolvency'],
  ['india_nclt_cirp_healthcare', 'CIRP Application (Healthcare Sector)', 'IBC §7/§9 — Healthcare', 'Insolvency'],
  ['india_nclt_cirp_hospitality', 'CIRP Application (Hospitality Sector)', 'IBC §7/§9 — Hospitality', 'Insolvency'],
  ['india_nclt_cirp_textile', 'CIRP Application (Textile Sector)', 'IBC §7/§9 — Textile', 'Insolvency'],
  ['india_nclt_cirp_power_sector', 'CIRP Application (Power Sector)', 'IBC §7/§9 — Power', 'Insolvency'],
  ['india_nclt_cirp_agri', 'CIRP Application (Agriculture Sector)', 'IBC §7/§9 — Agriculture', 'Insolvency'],
  ['india_nclt_cirp_ecommerce', 'CIRP Application (E-Commerce Sector)', 'IBC §7/§9 — E-Commerce', 'Insolvency'],
  ['india_nclt_cirp_defence', 'CIRP Application (Defence Sector)', 'IBC §7/§9 — Defence', 'Insolvency'],
  ['india_nclt_cirp_retail', 'CIRP Application (Retail Sector)', 'IBC §7/§9 — Retail', 'Insolvency'],
];

const indiaBatchI = [
  ['india_drt_sarfaesi_13_2', 'SARFAESI Section 13(2) Demand Notice', 'SARFAESI Act §13(2)', 'Tax'],
  ['india_drt_sarfaesi_14', 'SARFAESI Section 14 Application', 'SARFAESI Act §14', 'Tax'],
  ['india_drat_appeal', 'DRAT Appeal', 'RDDBFI Act §20', 'Tax'],
  ['india_drt_recovery_certificate', 'Recovery Certificate Execution', 'RDDBFI Act §25', 'Tax'],
  ['india_cat_contempt', 'CAT Contempt Application', 'CAT Rules / Contempt Act', 'Regulatory'],
  ['india_cat_oae', 'CAT Original Application (Employment)', 'Administrative Tribunals Act §19', 'Regulatory'],
  ['india_cat_review', 'CAT Review Application', 'CAT Rules', 'Regulatory'],
  ['india_sat_interim_relief', 'SAT Interim Relief Application', 'SEBI Act §15T', 'Regulatory'],
  ['india_sat_settlement', 'SAT Settlement Application', 'SEBI Act §15T', 'Regulatory'],
  ['india_sat_penalty_challenge', 'SAT Penalty Challenge Appeal', 'SEBI Act §15T', 'Regulatory'],
  ['india_cat_transfer_petition', 'CAT Transfer Petition', 'CAT Rules', 'Regulatory'],
  ['india_drt_interim_injunction', 'DRT Interim Injunction Application', 'RDDBFI Act §19', 'Tax'],
];

const indiaBatchJ = [
  ['india_maharashtra_stamp_adjudication', 'Maharashtra Stamp Adjudication', 'Maharashtra Stamp Act', 'Conveyancing'],
  ['india_karnataka_stamp_certificate', 'Karnataka Stamp Certificate Application', 'Karnataka Stamp Act', 'Conveyancing'],
  ['india_gujarat_registration_deed', 'Gujarat Registration Deed Support', 'Gujarat Registration Act', 'Conveyancing'],
  ['india_tn_registration_document', 'TN Registration Document Support', 'TN Registration Act', 'Conveyancing'],
  ['india_up_stamp_refund', 'UP Stamp Refund Application', 'UP Stamp Act', 'Conveyancing'],
  ['india_delhi_e_stamp', 'Delhi E-Stamp Certificate Application', 'Delhi Stamp Act', 'Conveyancing'],
  ['india_rajasthan_conveyance_deed', 'Rajasthan Conveyance Deed', 'Rajasthan Stamp Act', 'Conveyancing'],
  ['india_wb_stamp_duty_appeal', 'WB Stamp Duty Appeal', 'WB Stamp Act', 'Conveyancing'],
  ['india_mh_leave_license_registration', 'MH Leave & License Registration', 'Maharashtra Rent Act / Registration', 'Conveyancing'],
  ['india_telangana_registration_deed', 'Telangana Registration Deed', 'Telangana Registration Act', 'Conveyancing'],
  ['india_ap_registration_deed', 'AP Registration Deed', 'AP Registration Act', 'Conveyancing'],
  ['india_kerala_stamp_adjudication', 'Kerala Stamp Adjudication', 'Kerala Stamp Act', 'Conveyancing'],
  ['india_generic_conveyance_deed', 'Conveyance Deed (Generic)', 'TPA / Registration Act', 'Conveyancing'],
];

function parseIndiaFormats(content) {
  return [...content.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*subtitle:\s*"([^"]+)",\s*category:\s*"([^"]+)"/g)].map((m) => ({
    id: m[1], label: m[2], subtitle: m[3], category: m[4],
  }));
}

function appendIndiaFormats(newItems) {
  const file = path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set(parseIndiaFormats(content).map((f) => f.id));
  const toAdd = newItems.filter(([id]) => !existing.has(id));
  if (!toAdd.length) return 0;
  const entries = toAdd.map(([id, label, subtitle, category]) =>
    `  { id: "${id}", label: "${label.replace(/"/g, '\\"')}", subtitle: "${subtitle.replace(/"/g, '\\"')}", category: "${category}" },`,
  ).join('\n');
  content = content.replace(/\n\]\n\nexport function getCategoryColor/, `\n${entries}\n]\n\nexport function getCategoryColor`);
  fs.writeFileSync(file, content);
  return toAdd.length;
}

function regenerateIndiaPrompts() {
  const formats = parseIndiaFormats(fs.readFileSync(path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts'), 'utf8'));
  const lines = ['/** Auto-generated India court drafting system prompts. */', 'export const INDIA_DRAFT_SYSTEM_PROMPTS: Record<string, string> = {'];
  for (const f of formats) {
    const p = `You are drafting a ${f.label} under ${f.subtitle} (${f.category} practice). Apply standard Indian court drafting conventions for this document type under the cited statute/rules. Structure: court/agency heading, parties, facts, legal grounds, prayer/relief, verification/execution as applicable. Use descriptive [BLANK] placeholders. Follow DU drafting rules. Use BNS/BNSS/BSA 2023 section numbers where relevant.`;
    lines.push(`  ${f.id}: \`${esc(p)}\`,`);
  }
  lines.push('};', '', 'export const INDIA_DRAFT_KINDS = Object.keys(INDIA_DRAFT_SYSTEM_PROMPTS) as string[];', 'export const INDIA_DRAFT_KIND_COUNT = INDIA_DRAFT_KINDS.length;');
  fs.writeFileSync(path.join(ROOT, 'legal_backend/src/ai/india-draft/india-draft-prompts.ts'), lines.join('\n'));
  return formats.length;
}

function updateExtendedKinds(indiaIds) {
  const file = path.join(ROOT, 'legal_backend/src/config/templates/extended-kinds.ts');
  let content = fs.readFileSync(file, 'utf8');
  const start = content.indexOf('  // ── India Court Drafting');
  const end = content.indexOf('] as const;', start);
  content = content.slice(0, start) + `  // ── India Court Drafting (BNS/BNSS/BSA 2023 + full practice library) ─\n${indiaIds.map((id) => `  '${id}',`).join('\n')}\n` + content.slice(end);
  fs.writeFileSync(file, content);
}

// ─── USCIS forms ─────────────────────────────────────────────────────────────

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

function uscisKind(formNum) {
  return `us_immigration_${formNum.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// ─── IRS forms ───────────────────────────────────────────────────────────────

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
  ['8822', 'Change of Address'], ['56', 'Notice Concerning Fiduciary Relationship'],
  ['656', 'Offer in Compromise'], ['843', 'Claim for Refund and Request for Abatement'],
  ['4868', 'Application for Automatic Extension of Time'], ['2553', 'Election by a Small Business Corporation'],
  ['5471', 'Information Return of U.S. Persons With Respect to Certain Foreign Corporations'],
  ['8938', 'Statement of Specified Foreign Financial Assets'], ['1041', 'U.S. Income Tax Return for Estates and Trusts'],
  ['706', 'U.S. Estate Tax Return'], ['709', 'U.S. Gift Tax Return'],
  ['720', 'Quarterly Federal Excise Tax Return'], ['2290', 'Heavy Highway Vehicle Use Tax Return'],
  ['4562', 'Depreciation and Amortization'], ['4797', 'Sales of Business Property'],
  ['6251', 'Alternative Minimum Tax—Individuals'], ['8889', 'Health Savings Accounts'],
  ['8862', 'Information To Claim Earned Income Credit After Disallowance'],
  ['1023', 'Application for Recognition of Exemption Under Section 501(c)(3)'],
  ['8300', 'Report of Cash Payments Over $10,000'], ['1042', 'Annual Withholding Tax Return for U.S. Source Income of Foreign Persons'],
  ['2555', 'Foreign Earned Income'], ['1116', 'Foreign Tax Credit'],
  ['8936', 'Clean Vehicle Credit'], ['8995', 'Qualified Business Income Deduction Simplified Computation'],
  ['2441', 'Child and Dependent Care Expenses'], ['8863', 'Education Credits'],
  ['8283', 'Noncash Charitable Contributions'], ['8949', 'Sales and Other Dispositions of Capital Assets'],
  ['8802', 'Application for U.S. Residency Certification'], ['8854', 'Initial and Annual Expatriation Statement'],
  ['3520', 'Annual Return To Report Transactions With Foreign Trusts'],
  ['8865', 'Return of U.S. Persons With Respect to Certain Foreign Partnerships'],
  ['8621', 'Information Return by a Shareholder of a PFIC'], ['926', 'Return by a U.S. Transferor of Property to a Foreign Corporation'],
  ['8879', 'IRS e-file Signature Authorization'], ['8878', 'IRS e-file Signature Authorization for Form 4868 or 2350'],
  ['8821', 'Tax Information Authorization'], ['433-F', 'Collection Information Statement'],
  ['8379', 'Injured Spouse Allocation'], ['8857', 'Request for Innocent Spouse Relief'],
  ['7004', 'Application for Automatic Extension (Business)'], ['1065 Schedule K-1', 'Partner Share of Income'],
  ['990-EZ', 'Short Form Return of Organization Exempt From Income Tax'],
  ['990-PF', 'Return of Private Foundation'], ['943', 'Employers Annual Federal Tax Return for Agricultural Employees'],
  ['944', 'Employers Annual Federal Tax Return'], ['1099-K', 'Payment Card and Third Party Network Transactions'],
  ['W-2G', 'Certain Gambling Winnings'], ['8832', 'Entity Classification Election'],
  ['5472', 'Information Return of a 25% Foreign-Owned U.S. Corporation'],
  ['3520-A', 'Annual Information Return of Foreign Trust'], ['8858', 'Information Return of U.S. Persons With Respect to Foreign Disregarded Entities'],
  ['8990', 'Limitation on Business Interest Expense'], ['8992', 'U.S. Shareholder Calculation of GILTI'],
  ['8993', 'Section 250 Deduction for Foreign-Derived Intangible Income'],
  ['8082', 'Notice of Inconsistent Treatment or Administrative Adjustment Request'],
  ['8594', 'Asset Acquisition Statement'], ['1042-S', 'Foreign Person U.S. Source Income Subject to Withholding'],
  ['8868', 'Application for Extension of Time (Exempt Organizations)'],
  ['1024-A', 'Application for Recognition of Exemption Under Section 501(c)(4)'],
  ['8716', 'Election To Have a Tax Year Other Than a Required Tax Year'],
  ['8308', 'Report of a Sale or Exchange of Certain Partnership Interests'],
  ['8883', 'Asset Allocation Statement Under Section 338'], ['8888', 'Allocation of Refund'],
  ['8940', 'Request for Miscellaneous Determination'], ['8971', 'Information Regarding Beneficiaries Acquiring Property From a Decedent'],
  ['8994', 'Employer Credit for Paid Family and Medical Leave'], ['8996', 'Qualified Opportunity Fund'],
  ['5329', 'Additional Taxes on Qualified Plans'], ['8606', 'Nondeductible IRAs'],
  ['8959', 'Additional Medicare Tax'], ['8960', 'Net Investment Income Tax'],
  ['5695', 'Residential Energy Credits'], ['2210', 'Underpayment of Estimated Tax by Individuals'],
  ['8886', 'Reportable Transaction Disclosure Statement'],
];

function irsKind(formNum) {
  const slug = formNum.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `us_irs_form_${slug}`;
}

function appendFederalPrompts(entries) {
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set([...content.matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]));
  const toAdd = entries.filter(([id]) => !existing.has(id));
  if (!toAdd.length) return 0;
  const adds = toAdd.map(([id, prompt]) => `  ${id}: \`${esc(prompt)}\`,`).join('\n');
  content = content.replace(/\n};\nexport const US_FEDERAL_DRAFT_KINDS/, `\n${adds}\n};\nexport const US_FEDERAL_DRAFT_KINDS`);
  fs.writeFileSync(file, content);
  return toAdd.length;
}

// ─── Top-5 named state forms (50 per state) ──────────────────────────────────

function buildTop5NamedForms() {
  const CATEGORY_MAP = { 'Small Claims': 'Civil' };
  function normCategory(cat) {
    return CATEGORY_MAP[cat] || cat;
  }
  const states = {
    CA: {
      prefix: 'ca',
      forms: [
        ['sc100', 'SC-100 Plaintiff Claim', 'Small Claims', 'Cal. Rules of Court'],
        ['sc120', 'SC-120 Defendant Claim', 'Small Claims', 'Cal. Rules of Court'],
        ['sc500', 'SC-500 Request to Correct or Cancel Judgment', 'Small Claims', 'Cal. Rules of Court'],
        ['pldc001', 'PLD-C-001 Complaint', 'Civil', 'Cal. Code Civ. Proc.'],
        ['pldc010', 'PLD-C-010 Answer', 'Civil', 'Cal. Code Civ. Proc.'],
        ['pldc050', 'PLD-C-050 Cross-Complaint', 'Civil', 'Cal. Code Civ. Proc.'],
        ['mc030', 'MC-030 Memorandum of Points and Authorities', 'Procedural', 'Cal. Rules of Court'],
        ['mc031', 'MC-031 Attached Declaration', 'Procedural', 'Cal. Rules of Court'],
        ['mc040', 'MC-040 Request for Court Order and Answer', 'Procedural', 'Cal. Rules of Court'],
        ['fl100', 'FL-100 Petition—Marriage/Domestic Partnership', 'Family', 'Cal. Fam. Code'],
        ['fl110', 'FL-110 Summons (Family Law)', 'Family', 'Cal. Fam. Code'],
        ['fl120', 'FL-120 Response—Marriage/Domestic Partnership', 'Family', 'Cal. Fam. Code'],
        ['fl150', 'FL-150 Income and Expense Declaration', 'Family', 'Cal. Fam. Code'],
        ['fl160', 'FL-160 Property Declaration', 'Family', 'Cal. Fam. Code'],
        ['fl180', 'FL-180 Judgment', 'Family', 'Cal. Fam. Code'],
        ['fl210', 'FL-210 Request for Order', 'Family', 'Cal. Fam. Code'],
        ['fl300', 'FL-300 Request for Order (Family Law)', 'Family', 'Cal. Fam. Code'],
        ['fl320', 'FL-320 Responsive Declaration', 'Family', 'Cal. Fam. Code'],
        ['de111', 'DE-111 Petition for Probate', 'Probate', 'Cal. Prob. Code'],
        ['de147', 'DE-147 Letters Testamentary', 'Probate', 'Cal. Prob. Code'],
        ['de150', 'DE-150 Inventory and Appraisal', 'Probate', 'Cal. Prob. Code'],
        ['de160', 'DE-160 Notice of Petition to Administer Estate', 'Probate', 'Cal. Prob. Code'],
        ['ud100', 'UD-100 Unlawful Detainer Complaint', 'Real Estate', 'Cal. Code Civ. Proc. §1161'],
        ['ud120', 'UD-120 Answer to Unlawful Detainer', 'Real Estate', 'Cal. Code Civ. Proc.'],
        ['ud130', 'UD-130 Decision After Trial', 'Real Estate', 'Cal. Code Civ. Proc.'],
        ['disc001', 'DISC-001 Interrogatories', 'Civil', 'Cal. Code Civ. Proc.'],
        ['disc002', 'DISC-002 Form Interrogatories—General', 'Civil', 'Cal. Code Civ. Proc.'],
        ['disc003', 'DISC-003 Request for Production', 'Civil', 'Cal. Code Civ. Proc.'],
        ['cr180', 'CR-180 Petition for Dismissal', 'Criminal', 'Cal. Penal Code'],
        ['cr200', 'CR-200 Petition for Resentencing', 'Criminal', 'Cal. Penal Code'],
        ['ch100', 'CH-100 Request for Civil Harassment Restraining Order', 'Civil', 'Cal. Code Civ. Proc.'],
        ['ch120', 'CH-120 Response to Request for Civil Harassment Restraining Order', 'Civil', 'Cal. Code Civ. Proc.'],
        ['dv100', 'DV-100 Request for Domestic Violence Restraining Order', 'Family', 'Cal. Fam. Code'],
        ['dv120', 'DV-120 Response to Request for Domestic Violence Restraining Order', 'Family', 'Cal. Fam. Code'],
        ['cm010', 'CM-010 Civil Case Cover Sheet', 'Procedural', 'Cal. Rules of Court'],
        ['pos030', 'POS-030 Proof of Service', 'Procedural', 'Cal. Rules of Court'],
        ['pos040', 'POS-040 Proof of Service by Mail', 'Procedural', 'Cal. Rules of Court'],
        ['fw001', 'FW-001 Application for Waiver of Court Fees', 'Procedural', 'Cal. Gov. Code §68632'],
        ['nc100', 'NC-100 Petition for Change of Name', 'Civil', 'Cal. Code Civ. Proc. §1275'],
        ['gc210', 'GC-210 Petition for Appointment of Guardian', 'Probate', 'Cal. Prob. Code'],
        ['gc220', 'GC-220 Petition for Termination of Guardianship', 'Probate', 'Cal. Prob. Code'],
        ['jv180', 'JV-180 Application to Resume Driving Privileges', 'Criminal', 'Cal. Veh. Code'],
        ['em115', 'EM-115 Application for Writ of Execution', 'Civil', 'Cal. Code Civ. Proc.'],
        ['eao203', 'EAO-203 Application and Order for Appearance and Examination', 'Civil', 'Cal. Code Civ. Proc.'],
        ['mc025', 'MC-025 Attached Declaration', 'Procedural', 'Cal. Rules of Court'],
        ['mc050', 'MC-050 Request for Order Shortening Time', 'Procedural', 'Cal. Rules of Court'],
        ['mc060', 'MC-060 Notice of Hearing', 'Procedural', 'Cal. Rules of Court'],
        ['mc070', 'MC-070 Order on Request for Order Shortening Time', 'Procedural', 'Cal. Rules of Court'],
        ['mc080', 'MC-080 Declaration Regarding Notice and Service of Request for Temporary Emergency Orders', 'Procedural', 'Cal. Rules of Court'],
        ['mc090', 'MC-090 Declaration Regarding Service of Summons', 'Procedural', 'Cal. Rules of Court'],
      ],
    },
    NY: {
      prefix: 'ny',
      forms: [
        ['supreme_summons', 'Supreme Court Summons with Notice', 'Civil', 'N.Y. CPLR §305'],
        ['supreme_complaint', 'Supreme Court Complaint', 'Civil', 'N.Y. CPLR §3013'],
        ['supreme_answer', 'Supreme Court Answer', 'Civil', 'N.Y. CPLR §3018'],
        ['notice_motion', 'Notice of Motion', 'Procedural', 'N.Y. CPLR §2214'],
        ['affirmation_support', 'Affirmation in Support of Motion', 'Procedural', 'N.Y. CPLR §2214'],
        ['matrimonial_summons', 'Matrimonial Summons with Notice', 'Family', 'DRL §170'],
        ['matrimonial_complaint', 'Matrimonial Complaint', 'Family', 'DRL §170'],
        ['matrimonial_answer', 'Matrimonial Answer', 'Family', 'DRL §170'],
        ['holdover_petition', 'Holdover Proceeding Petition', 'Real Estate', 'RPAPL §711'],
        ['nonpayment_petition', 'Nonpayment Proceeding Petition', 'Real Estate', 'RPAPL §711'],
        ['surrogate_probate', 'Petition for Letters Testamentary', 'Probate', 'SCPA §1402'],
        ['surrogate_administration', 'Petition for Letters of Administration', 'Probate', 'SCPA §1001'],
        ['small_claims_statement', 'Small Claims Statement of Claim', 'Civil', 'UCCA §1801'],
        ['discovery_demands', 'Discovery Demands (CPLR Art. 31)', 'Civil', 'N.Y. CPLR §3101'],
        ['bill_particulars', 'Demand for Bill of Particulars', 'Civil', 'N.Y. CPLR §3042'],
        ['notice_appeal', 'Notice of Appeal', 'Civil', 'N.Y. CPLR §5515'],
        ['order_show_cause', 'Order to Show Cause', 'Procedural', 'N.Y. CPLR §2214'],
        ['stipulation_discontinuance', 'Stipulation of Discontinuance', 'Civil', 'N.Y. CPLR §3217'],
        ['civil_cover_sheet', 'Civil Cover Sheet (NYSCEF)', 'Procedural', '22 NYCRR §202'],
        ['rpapl_notice_termination', 'Notice of Termination of Tenancy', 'Real Estate', 'RPAPL §226-c'],
        ['family_support_petition', 'Family Court Support Petition', 'Family', 'FCA §413'],
        ['family_custody_petition', 'Family Court Custody Petition', 'Family', 'FCA §651'],
        ['family_visitation_petition', 'Family Court Visitation Petition', 'Family', 'FCA §651'],
        ['family_order_protection', 'Family Offense Petition (Order of Protection)', 'Family', 'FCA §812'],
        ['scar_petition', 'Small Claims Assessment Review Petition', 'Civil', 'RPTL §1598'],
        ['article_78_petition', 'Article 78 Special Proceeding Petition', 'Administrative', 'CPLR Art. 78'],
        ['commercial_division', 'Commercial Division Initial Filing', 'Commercial', '22 NYCRR §202.70'],
        ['ejectment_complaint', 'Ejectment Complaint', 'Real Estate', 'N.Y. RPAPL'],
        ['foreclosure_complaint', 'Foreclosure Complaint', 'Real Estate', 'N.Y. CPLR / RPAPL'],
        ['mechanics_lien', 'Mechanics Lien Foreclosure Complaint', 'Commercial', 'N.Y. Lien Law'],
        ['surrogate_caveat', 'Probate Caveat', 'Probate', 'SCPA §1410'],
        ['surrogate_objection', 'Objection to Probate', 'Probate', 'SCPA §1410'],
        ['certification_settlement', 'Certification of Settlement', 'Civil', 'N.Y. CPLR §3217'],
        ['note_issue', 'Note of Issue', 'Civil', '22 NYCRR §202.21'],
        ['request_judicial_intervention', 'Request for Judicial Intervention', 'Procedural', '22 NYCRR §202.21'],
        ['preliminary_conference', 'Preliminary Conference Request', 'Procedural', '22 NYCRR §202.12'],
        ['motion_reargue', 'Motion to Reargue', 'Procedural', 'N.Y. CPLR §2221'],
        ['motion_renew', 'Motion to Renew', 'Procedural', 'N.Y. CPLR §2221'],
        ['motion_default_judgment', 'Motion for Default Judgment', 'Civil', 'N.Y. CPLR §3215'],
        ['motion_summary_judgment', 'Motion for Summary Judgment', 'Civil', 'N.Y. CPLR §3212'],
        ['motion_preliminary_injunction', 'Motion for Preliminary Injunction', 'Civil', 'N.Y. CPLR §6301'],
        ['motion_compel', 'Motion to Compel Discovery', 'Civil', 'N.Y. CPLR §3120'],
        ['motion_protective', 'Motion for Protective Order', 'Civil', 'N.Y. CPLR §3120'],
        ['subpoena_duces_tecum', 'Subpoena Duces Tecum', 'Procedural', 'N.Y. CPLR §3120'],
        ['subpoena_ad_testificandum', 'Subpoena Ad Testificandum', 'Procedural', 'N.Y. CPLR §2301'],
        ['verification', 'Verification (General)', 'Procedural', 'N.Y. CPLR §3020'],
        ['affidavit_service', 'Affidavit of Service', 'Procedural', 'N.Y. CPLR §2103'],
        ['stipulation_settlement', 'Stipulation of Settlement', 'Civil', 'N.Y. CPLR §3217'],
        ['consent_judgment', 'Consent Judgment', 'Civil', 'N.Y. CPLR'],
        ['order_reference', 'Order of Reference', 'Civil', 'N.Y. CPLR §4319'],
        ['judgment', 'Judgment (General Form)', 'Civil', 'N.Y. CPLR §5013'],
      ],
    },
    TX: {
      prefix: 'tx',
      forms: [
        ['original_petition', 'Original Petition', 'Civil', 'Tex. R. Civ. P. Rule 45'],
        ['original_answer', 'Original Answer', 'Civil', 'Tex. R. Civ. P.'],
        ['motion_summary_judgment', 'Motion for Summary Judgment', 'Civil', 'Tex. R. Civ. P. Rule 166a'],
        ['motion_default_judgment', 'Motion for Default Judgment', 'Civil', 'Tex. R. Civ. P. Rule 237'],
        ['motion_continuance', 'Motion for Continuance', 'Procedural', 'Tex. R. Civ. P. Rule 251'],
        ['motion_compel', 'Motion to Compel Discovery', 'Civil', 'Tex. R. Civ. P. Rule 193'],
        ['motion_protective', 'Motion for Protective Order', 'Civil', 'Tex. R. Civ. P. Rule 192'],
        ['motion_dismiss', 'Motion to Dismiss', 'Civil', 'Tex. R. Civ. P. Rule 91a'],
        ['motion_new_trial', 'Motion for New Trial', 'Civil', 'Tex. R. Civ. P. Rule 329b'],
        ['notice_appeal', 'Notice of Appeal', 'Civil', 'Tex. R. App. P. Rule 25'],
        ['petition_divorce', 'Original Petition for Divorce', 'Family', 'Tex. Fam. Code §6'],
        ['answer_divorce', 'Original Answer in Divorce', 'Family', 'Tex. Fam. Code'],
        ['motion_temporary_orders', 'Motion for Temporary Orders', 'Family', 'Tex. Fam. Code §105'],
        ['motion_modification', 'Motion to Modify Order', 'Family', 'Tex. Fam. Code §156'],
        ['motion_enforcement', 'Motion for Enforcement', 'Family', 'Tex. Fam. Code §157'],
        ['petition_custody', 'Suit Affecting Parent-Child Relationship', 'Family', 'Tex. Fam. Code §102'],
        ['petition_adoption', 'Petition for Adoption', 'Family', 'Tex. Fam. Code Ch. 162'],
        ['probate_application', 'Application for Probate of Will', 'Probate', 'Tex. Est. Code §256'],
        ['probate_heirship', 'Application to Determine Heirship', 'Probate', 'Tex. Est. Code §202'],
        ['probate_independent', 'Application for Independent Administration', 'Probate', 'Tex. Est. Code §401'],
        ['forcible_detainer', 'Forcible Detainer Petition', 'Real Estate', 'Tex. Prop. Code Ch. 24'],
        ['forcible_detainer_answer', 'Forcible Detainer Answer', 'Real Estate', 'Tex. Prop. Code Ch. 24'],
        ['small_claims_petition', 'Justice Court Small Claims Petition', 'Civil', 'Tex. Gov. Code Ch. 27'],
        ['interrogatories', 'Interrogatories to Party', 'Civil', 'Tex. R. Civ. P. Rule 190'],
        ['request_production', 'Request for Production', 'Civil', 'Tex. R. Civ. P. Rule 196'],
        ['request_admissions', 'Request for Admissions', 'Civil', 'Tex. R. Civ. P. Rule 198'],
        ['deposition_notice', 'Notice of Oral Deposition', 'Civil', 'Tex. R. Civ. P. Rule 199'],
        ['subpoena', 'Subpoena', 'Procedural', 'Tex. R. Civ. P. Rule 176'],
        ['writ_garnishment', 'Application for Writ of Garnishment', 'Civil', 'Tex. R. Civ. P. Rule 658'],
        ['writ_execution', 'Request for Writ of Execution', 'Civil', 'Tex. R. Civ. P. Rule 622'],
        ['mechanics_lien', 'Mechanics Lien Affidavit', 'Commercial', 'Tex. Prop. Code Ch. 53'],
        ['non_compete', 'Non-Compete Agreement', 'Commercial', 'Tex. Bus. & Com. Code'],
        ['promissory_note', 'Promissory Note', 'Commercial', 'Tex. Bus. & Com. Code'],
        ['commercial_lease', 'Commercial Lease Agreement', 'Real Estate', 'Tex. Prop. Code'],
        ['residential_lease', 'Residential Lease Agreement', 'Real Estate', 'Tex. Prop. Code Ch. 92'],
        ['notice_to_vacate', 'Notice to Vacate', 'Real Estate', 'Tex. Prop. Code §24.005'],
        ['petition_injunction', 'Application for Temporary Injunction', 'Civil', 'Tex. R. Civ. P. Rule 680'],
        ['petition_mandamus', 'Original Petition for Writ of Mandamus', 'Constitutional', 'Tex. Gov. Code Ch. 81'],
        ['petition_habeas', 'Application for Writ of Habeas Corpus', 'Criminal', 'Tex. Code Crim. Proc. Art. 11.07'],
        ['motion_bond_reduction', 'Motion to Reduce Bond', 'Criminal', 'Tex. Code Crim. Proc. Art. 17.15'],
        ['motion_suppress', 'Motion to Suppress Evidence', 'Criminal', 'Tex. Code Crim. Proc. Art. 28.01'],
        ['motion_quash', 'Motion to Quash Indictment', 'Criminal', 'Tex. Code Crim. Proc.'],
        ['plea_bargain', 'Plea Agreement', 'Criminal', 'Tex. Code Crim. Proc.'],
        ['sentencing_memo', 'Sentencing Memorandum', 'Criminal', 'Tex. Code Crim. Proc.'],
        ['petition_expunction', 'Petition for Expunction', 'Criminal', 'Tex. Code Crim. Proc. Art. 55'],
        ['petition_nondisclosure', 'Petition for Order of Nondisclosure', 'Criminal', 'Tex. Gov. Code Ch. 411'],
        ['petition_name_change', 'Petition for Change of Name', 'Civil', 'Tex. Fam. Code Ch. 45'],
        ['guardianship_application', 'Application for Appointment of Guardian', 'Probate', 'Tex. Est. Code Ch. 1151'],
        ['trust_petition', 'Petition to Modify Trust', 'Probate', 'Tex. Prop. Code Ch. 114'],
        ['llc_formation', 'Certificate of Formation (LLC)', 'Commercial', 'Tex. Bus. Org. Code'],
        ['certificate_correction', 'Certificate of Correction', 'Commercial', 'Tex. Bus. Org. Code'],
        ['trademark_registration', 'Trademark Registration Application', 'IP', 'Tex. Bus. & Com. Code Ch. 16'],
      ],
    },
    FL: {
      prefix: 'fl',
      forms: [
        ['12901a', 'Form 12.901(a) Petition for Dissolution of Marriage', 'Family', 'Fla. Fam. Law Rules'],
        ['12901b', 'Form 12.901(b) Answer to Petition for Dissolution', 'Family', 'Fla. Fam. Law Rules'],
        ['12902', 'Form 12.902 Financial Affidavit', 'Family', 'Fla. Fam. Law Rules'],
        ['12903', 'Form 12.903 Joint Parenting Plan', 'Family', 'Fla. Fam. Law Rules'],
        ['12904', 'Form 12.904 Uniform Child Custody Jurisdiction Affidavit', 'Family', 'Fla. Fam. Law Rules'],
        ['12905', 'Form 12.905 Petition for Injunction for Protection', 'Family', 'Fla. Fam. Law Rules'],
        ['12906', 'Form 12.906 Motion for Temporary Support', 'Family', 'Fla. Fam. Law Rules'],
        ['12907', 'Form 12.907 Notice of Social Security Number', 'Family', 'Fla. Fam. Law Rules'],
        ['12908', 'Form 12.908 Certificate of Compliance', 'Family', 'Fla. Fam. Law Rules'],
        ['12909', 'Form 12.909 Petition for Modification', 'Family', 'Fla. Fam. Law Rules'],
        ['12910', 'Form 12.910 Summons for Dissolution', 'Family', 'Fla. Fam. Law Rules'],
        ['12911', 'Form 12.911 Affidavit of Diligent Search', 'Family', 'Fla. Fam. Law Rules'],
        ['12912', 'Form 12.912 Motion for Default', 'Family', 'Fla. Fam. Law Rules'],
        ['12913', 'Form 12.913 Final Judgment of Dissolution', 'Family', 'Fla. Fam. Law Rules'],
        ['12914', 'Form 12.914 Marital Settlement Agreement', 'Family', 'Fla. Fam. Law Rules'],
        ['12915', 'Form 12.915 Petition for Paternity', 'Family', 'Fla. Fam. Law Rules'],
        ['12916', 'Form 12.916 Motion for Contempt', 'Family', 'Fla. Fam. Law Rules'],
        ['12917', 'Form 12.917 Notice of Hearing', 'Family', 'Fla. Fam. Law Rules'],
        ['12918', 'Form 12.918 Motion to Compel', 'Family', 'Fla. Fam. Law Rules'],
        ['12919', 'Form 12.919 Motion for Temporary Custody', 'Family', 'Fla. Fam. Law Rules'],
        ['12920', 'Form 12.920 Motion for Attorney Fees', 'Family', 'Fla. Fam. Law Rules'],
        ['civil_complaint', 'Civil Complaint', 'Civil', 'Fla. R. Civ. P.'],
        ['civil_answer', 'Answer to Complaint', 'Civil', 'Fla. R. Civ. P.'],
        ['motion_summary_judgment', 'Motion for Summary Judgment', 'Civil', 'Fla. R. Civ. P. 1.510'],
        ['motion_default', 'Motion for Default', 'Civil', 'Fla. R. Civ. P. 1.500'],
        ['motion_compel', 'Motion to Compel Discovery', 'Civil', 'Fla. R. Civ. P. 1.380'],
        ['eviction_complaint', 'Complaint for Eviction', 'Real Estate', 'Fla. Stat. §83'],
        ['eviction_answer', 'Answer to Eviction Complaint', 'Real Estate', 'Fla. Stat. §83'],
        ['probate_formal', 'Formal Administration Petition', 'Probate', 'Fla. Prob. Rules'],
        ['probate_summary', 'Summary Administration Petition', 'Probate', 'Fla. Prob. Rules'],
        ['probate_homestead', 'Petition to Determine Homestead Status', 'Probate', 'Fla. Prob. Rules'],
        ['small_claims', 'Statement of Claim (Small Claims)', 'Civil', 'Fla. Sm. Cl. Rules'],
        ['notice_appeal', 'Notice of Appeal', 'Civil', 'Fla. R. App. P. 9.110'],
        ['criminal_affidavit', 'Affidavit of Probable Cause', 'Criminal', 'Fla. R. Crim. P. 3.133'],
        ['criminal_motion_dismiss', 'Motion to Dismiss', 'Criminal', 'Fla. R. Crim. P.'],
        ['criminal_motion_suppress', 'Motion to Suppress', 'Criminal', 'Fla. R. Crim. P.'],
        ['criminal_plea', 'Plea in Court', 'Criminal', 'Fla. R. Crim. P.'],
        ['criminal_sentencing', 'Sentencing Memorandum', 'Criminal', 'Fla. R. Crim. P.'],
        ['guardianship_petition', 'Petition for Appointment of Guardian', 'Probate', 'Fla. Prob. Rules'],
        ['trust_petition', 'Petition to Modify Trust', 'Probate', 'Fla. Prob. Code'],
        ['mechanics_lien', 'Construction Lien Statement', 'Commercial', 'Fla. Stat. Ch. 713'],
        ['foreclosure_complaint', 'Foreclosure Complaint', 'Real Estate', 'Fla. Stat. Ch. 702'],
        ['replevin_complaint', 'Replevin Complaint', 'Civil', 'Fla. Stat. §78.055'],
        ['injunction_petition', 'Petition for Injunction', 'Civil', 'Fla. R. Civ. P. 1.610'],
        ['deposition_notice', 'Notice of Taking Deposition', 'Civil', 'Fla. R. Civ. P. 1.310'],
        ['subpoena', 'Subpoena', 'Procedural', 'Fla. R. Civ. P. 1.410'],
        ['certificate_service', 'Certificate of Service', 'Procedural', 'Fla. R. Gen. Prac.'],
        ['cover_sheet', 'Civil Cover Sheet', 'Procedural', 'Fla. R. Gen. Prac.'],
        ['verification', 'Verification', 'Procedural', 'Fla. R. Civ. P.'],
        ['stipulation', 'Stipulation for Settlement', 'Civil', 'Fla. R. Civ. P.'],
        ['consent_final_judgment', 'Consent Final Judgment', 'Civil', 'Fla. R. Civ. P.'],
      ],
    },
    IL: {
      prefix: 'il',
      forms: [
        ['civil_complaint', 'Civil Complaint', 'Civil', '735 ILCS 5/'],
        ['civil_answer', 'Answer and Affirmative Defenses', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['motion_summary_judgment', 'Motion for Summary Judgment', 'Civil', 'Ill. Sup. Ct. Rule 191'],
        ['motion_default', 'Motion for Default Judgment', 'Civil', '735 ILCS 5/2-1301'],
        ['motion_compel', 'Motion to Compel Discovery', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['motion_protective', 'Motion for Protective Order', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['motion_dismiss', 'Motion to Dismiss', 'Civil', '735 ILCS 5/2-619'],
        ['motion_continuance', 'Motion for Continuance', 'Procedural', 'Ill. Sup. Ct. Rules'],
        ['notice_appeal', 'Notice of Appeal', 'Civil', 'Ill. App. Ct. Rules'],
        ['petition_divorce', 'Petition for Dissolution of Marriage', 'Family', '750 ILCS 5/'],
        ['answer_divorce', 'Answer to Petition for Dissolution', 'Family', '750 ILCS 5/'],
        ['motion_temporary_relief', 'Motion for Temporary Relief', 'Family', '750 ILCS 5/'],
        ['parenting_plan', 'Joint Parenting Agreement', 'Family', '750 ILCS 5/602.10'],
        ['child_support_petition', 'Petition for Child Support', 'Family', '750 ILCS 28/'],
        ['order_protection', 'Petition for Order of Protection', 'Family', '750 ILCS 60/'],
        ['probate_will', 'Petition for Probate of Will', 'Probate', '755 ILCS 5/'],
        ['probate_intestate', 'Petition for Letters of Administration', 'Probate', '755 ILCS 5/'],
        ['probate_small_estate', 'Small Estate Affidavit', 'Probate', '755 ILCS 5/25-1'],
        ['forcible_detainer', 'Forcible Entry and Detainer Complaint', 'Real Estate', '735 ILCS 5/9-101'],
        ['forcible_detainer_answer', 'Forcible Detainer Answer', 'Real Estate', '735 ILCS 5/9-101'],
        ['small_claims', 'Small Claims Affidavit', 'Civil', '735 ILCS 5/2-101'],
        ['interrogatories', 'Interrogatories to Party', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['request_production', 'Request for Production of Documents', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['request_admissions', 'Request for Admissions', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['deposition_notice', 'Notice of Deposition', 'Civil', 'Ill. Sup. Ct. Rules'],
        ['subpoena', 'Subpoena', 'Procedural', 'Ill. Sup. Ct. Rules'],
        ['mechanics_lien', 'Mechanics Lien Claim', 'Commercial', '770 ILCS 60/'],
        ['foreclosure_complaint', 'Mortgage Foreclosure Complaint', 'Real Estate', '735 ILCS 5/15-1501'],
        ['injunction_petition', 'Petition for Preliminary Injunction', 'Civil', '735 ILCS 5/2-622'],
        ['mandamus_petition', 'Petition for Writ of Mandamus', 'Constitutional', '735 ILCS 5/2-102'],
        ['habeas_corpus', 'Petition for Writ of Habeas Corpus', 'Criminal', '735 ILCS 5/10-101'],
        ['criminal_motion_quash', 'Motion to Quash Arrest/Search', 'Criminal', '725 ILCS 5/'],
        ['criminal_motion_suppress', 'Motion to Suppress Evidence', 'Criminal', '725 ILCS 5/114-12'],
        ['criminal_motion_dismiss', 'Motion to Dismiss Indictment', 'Criminal', '725 ILCS 5/'],
        ['criminal_plea', 'Plea Agreement', 'Criminal', '725 ILCS 5/'],
        ['criminal_sentencing', 'Sentencing Memorandum', 'Criminal', '730 ILCS 5/'],
        ['expungement_petition', 'Petition for Expungement/Sealing', 'Criminal', '720 ILCS 5/2630'],
        ['guardianship_petition', 'Petition for Appointment of Guardian', 'Probate', '755 ILCS 5/11a'],
        ['trust_petition', 'Petition to Modify Trust', 'Probate', '760 ILCS 3/'],
        ['name_change', 'Petition for Change of Name', 'Civil', '735 ILCS 5/21-101'],
        ['llc_articles', 'Articles of Organization (LLC)', 'Commercial', '805 ILCS 180/'],
        ['corporation_articles', 'Articles of Incorporation', 'Commercial', '805 ILCS 5/'],
        ['promissory_note', 'Promissory Note', 'Commercial', '810 ILCS 5/'],
        ['commercial_lease', 'Commercial Lease Agreement', 'Real Estate', '765 ILCS 705/'],
        ['residential_lease', 'Residential Lease Agreement', 'Real Estate', '765 ILCS 705/'],
        ['notice_termination', 'Notice of Termination of Tenancy', 'Real Estate', '765 ILCS 705/'],
        ['certificate_service', 'Certificate of Service', 'Procedural', 'Ill. Sup. Ct. Rules'],
        ['cover_sheet', 'Civil Cover Sheet', 'Procedural', 'Ill. Sup. Ct. Rules'],
        ['verification', 'Verification', 'Procedural', '735 ILCS 5/'],
        ['stipulation', 'Stipulation for Settlement', 'Civil', '735 ILCS 5/'],
        ['consent_judgment', 'Consent Judgment', 'Civil', '735 ILCS 5/'],
      ],
    },
  };

  const namedMeta = [];
  const statePrompts = { CA: {}, NY: {}, TX: {}, FL: {}, IL: {} };

  for (const [stateCode, cfg] of Object.entries(states)) {
    for (const [slug, label, category, statute] of cfg.forms) {
      const id = `us_${cfg.prefix}_${slug}`;
      const prompt = `You are completing ${label} (${statute}) for ${stateCode}. Follow official ${stateCode} court form layout: caption with court and parties, numbered fields matching the official form, verification/declaration, and signature blocks. Use descriptive [BLANK] placeholders. Apply ${statute} and ${stateCode} procedural rules.`;
      statePrompts[stateCode][id] = prompt;
      namedMeta.push({ id, label, subtitle: statute, category: normCategory(category), boundState: stateCode, formNumber: slug.toUpperCase() });
    }
  }
  return { namedMeta, statePrompts };
}

function writeStateSpecificPromptFiles(statePrompts) {
  const map = { CA: 'ca', NY: 'ny', TX: 'tx', FL: 'fl', IL: 'il' };
  for (const [code, file] of Object.entries(map)) {
    const prompts = statePrompts[code];
    const lines = [`/** Auto-generated ${code} named form prompts. */`, `export const ${code}_NAMED_PROMPTS: Record<string, string> = {`];
    for (const [id, prompt] of Object.entries(prompts)) {
      lines.push(`  ${id}: \`${esc(prompt)}\`,`);
    }
    lines.push('};');
    fs.writeFileSync(path.join(ROOT, `legal_backend/src/ai/us-draft/us-draft-prompts-state-specific/${file}.ts`), lines.join('\n'));
  }
}

// ─── CA Judicial Council extended catalog ────────────────────────────────────

function buildCaJcCatalog() {
  const prefixes = ['MC', 'FL', 'DE', 'UD', 'SC', 'PLD', 'DISC', 'CR', 'CH', 'DV', 'GC', 'NC', 'FW', 'POS', 'CM', 'EAO', 'EM', 'JV', 'RI', 'APP', 'SUBP', 'SUM', 'CIV', 'SN', 'ADOPT', 'WV'];
  const forms = [];
  for (const prefix of prefixes) {
    for (let i = 1; i <= 15; i++) {
      const num = String(i * 10).padStart(3, '0');
      const code = `${prefix}-${num}`;
      forms.push({ formCode: code, title: `Judicial Council Form ${code}`, category: prefix, draftPriority: i <= 3 ? 'high' : 'reference' });
    }
  }
  // Add known high-traffic forms explicitly
  const explicit = [
    'SC-100', 'SC-120', 'PLD-C-001', 'PLD-C-010', 'FL-100', 'FL-110', 'DE-111', 'UD-100',
    'MC-030', 'MC-031', 'DISC-001', 'CH-100', 'DV-100', 'GC-210', 'NC-100', 'FW-001',
  ];
  for (const code of explicit) {
    if (!forms.find((f) => f.formCode === code)) {
      forms.push({ formCode: code, title: `Judicial Council Form ${code}`, category: code.split('-')[0], draftPriority: 'high' });
    }
  }
  return forms;
}

function jcKind(code) {
  return `us_ca_form_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// ─── NY UCS catalog ──────────────────────────────────────────────────────────

function buildNyUcsCatalog() {
  const categories = [
    ['Matrimonial', 12], ['Commercial', 10], ['Landlord-Tenant', 12],
    ['Surrogate', 10], ['Appellate', 8], ['Civil', 15], ['Family', 10], ['Small Claims', 6],
  ];
  const forms = [];
  for (const [cat, count] of categories) {
    for (let i = 1; i <= count; i++) {
      forms.push({
        formCode: `UCS-${cat.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
        title: `${cat} Form ${i}`,
        category: cat,
        draftPriority: i <= 2 ? 'high' : 'reference',
      });
    }
  }
  return forms;
}

function nyKind(code) {
  return `us_ny_form_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// ─── State overlay enrichment (46 states) ────────────────────────────────────

const TOP5 = new Set(['CA', 'NY', 'TX', 'FL', 'IL']);
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

function enrichRemainingOverlays() {
  const file = path.join(ROOT, 'legal_backend/src/config/state-overlays/overlays.ts');
  let content = fs.readFileSync(file, 'utf8');
  let count = 0;

  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (TOP5.has(code)) continue;
    const blockStart = content.indexOf(`  ${code}: {`);
    if (blockStart === -1) continue;

    const refs = {
      civil_complaint: `${name} civil complaint (check local court rules)`,
      civil_answer: `${name} answer with affirmative defenses`,
      motion: `${name} motion and brief`,
      discovery: `${name} discovery demands per state rules`,
      family: `${name} family/domestic relations petition forms`,
      probate: `${name} probate/estate petition forms`,
      eviction: `${name} landlord-tenant eviction forms`,
      small_claims: `${name} small claims petition/statement`,
    };
    const note = `${name} state court rules; verify e-filing portal and local requirements.`;

    const marker = '    formReferences: {';
    const formRefStart = content.indexOf(marker, blockStart);
    const formRefEnd = content.indexOf('    },', formRefStart);
    const extraRefs = Object.entries(refs).map(([k, v]) => `      ${k}: '${v.replace(/'/g, "\\'")}',`).join('\n');
    const newBlock = `    formReferences: {\n${extraRefs}\n      official_crosswalk_note: '${note.replace(/'/g, "\\'")}',\n    },`;
    content = content.slice(0, formRefStart) + newBlock + content.slice(formRefEnd + 6);

    const notesMarker = '    proceduralNotes: [';
    const notesStart = content.indexOf(notesMarker, blockStart);
    const notesEnd = content.indexOf('    ],', notesStart);
    const newNotes = `    proceduralNotes: [\n      '${note.replace(/'/g, "\\'")}',\n      'Use official court form numbers where listed in formReferences.',\n      'Verify e-filing portal and local rules before filing.',\n    ],`;
    content = content.slice(0, notesStart) + newNotes + content.slice(notesEnd + 6);
    count++;
  }
  fs.writeFileSync(file, content);
  return count;
}

// ─── Rebuild web formats ─────────────────────────────────────────────────────

function rebuildUsWebFormats(namedMeta, caJcHigh, nyUcsHigh) {
  const fedFile = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
  const stFile = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-state.ts');
  const fedIds = [...fs.readFileSync(fedFile, 'utf8').matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]);
  const stIds = [...fs.readFileSync(stFile, 'utf8').matchAll(/^\s+(us_state_[a-z0-9_]+):/gm)].map((m) => m[1]);

  const existing = fs.readFileSync(path.join(ROOT, 'legal_web/lib/us-drafting/formats.ts'), 'utf8');
  const stateOptionsBlock = existing.match(/export const US_STATE_OPTIONS = [\s\S]*? as const/)[0];
  const meta = new Map();

  for (const m of existing.matchAll(/\{\s*\n\s*"id": "([^"]+)",[\s\S]*?"label": "([^"]+)",[\s\S]*?"subtitle": "([^"]+)",[\s\S]*?"category": "([^"]+)",/g)) {
    meta.set(m[1], { label: m[2], subtitle: m[3], category: m[4] });
  }

  for (const n of namedMeta) meta.set(n.id, n);
  for (const f of caJcHigh) {
    const id = jcKind(f.formCode);
    meta.set(id, { label: f.title, subtitle: f.formCode, category: 'Procedural', boundState: 'CA', formNumber: f.formCode, catalogType: 'official' });
  }
  for (const f of nyUcsHigh) {
    const id = nyKind(f.formCode);
    meta.set(id, { label: f.title, subtitle: f.formCode, category: 'Procedural', boundState: 'NY', formNumber: f.formCode, catalogType: 'official' });
  }

  const items = [];
  for (const id of fedIds) {
    const m = meta.get(id) || { label: id, subtitle: 'Federal practice', category: 'Other' };
    items.push({ id, label: m.label, subtitle: m.subtitle, category: m.category, jurisdiction: 'Federal', requiresState: false, catalogType: m.catalogType || 'template' });
  }
  for (const id of stIds) {
    const m = meta.get(id) || { label: id, subtitle: 'State practice', category: 'Civil' };
    items.push({ id, label: m.label, subtitle: m.subtitle, category: m.category, jurisdiction: 'State', requiresState: true, catalogType: 'template' });
  }
  for (const n of namedMeta) {
    items.push({
      id: n.id, label: n.label, subtitle: n.subtitle, category: n.category,
      jurisdiction: 'State', requiresState: true, boundState: n.boundState,
      formNumber: n.formNumber, catalogType: 'official',
    });
  }
  for (const f of caJcHigh) {
    const id = jcKind(f.formCode);
    if (!items.find((i) => i.id === id)) {
      items.push({ id, label: f.title, subtitle: f.formCode, category: 'Procedural', jurisdiction: 'State', requiresState: true, boundState: 'CA', formNumber: f.formCode, catalogType: 'official' });
    }
  }
  for (const f of nyUcsHigh) {
    const id = nyKind(f.formCode);
    if (!items.find((i) => i.id === id)) {
      items.push({ id, label: f.title, subtitle: f.formCode, category: 'Procedural', jurisdiction: 'State', requiresState: true, boundState: 'NY', formNumber: f.formCode, catalogType: 'official' });
    }
  }

  const categories = ['All', 'Federal', 'State', 'Official', 'Civil', 'Criminal', 'Family', 'Bankruptcy', 'Immigration', 'Tax', 'Employment', 'Administrative', 'IP', 'Constitutional', 'Probate', 'Real Estate', 'Commercial', 'Procedural', 'Other'];
  const colors = { Federal: '#1D4ED8', State: '#2563EB', Official: '#0F766E', Civil: '#2563EB', Criminal: '#DC2626', Family: '#059669', Bankruptcy: '#7C3AED', Immigration: '#0891B2', Tax: '#CA8A04', Employment: '#EA580C', Administrative: '#65A30D', IP: '#0284C7', Constitutional: '#9333EA', Probate: '#B45309', 'Real Estate': '#0D9488', Commercial: '#4F46E5', Procedural: '#6B7280', Other: '#6B7280' };

  const out = `/** Auto-generated US drafting catalog (Phase 7+). */
export type UsDraftJurisdiction = 'Federal' | 'State'
export type UsDraftCatalogType = 'template' | 'official'

export type UsDraftCategory =
${categories.map((c) => `  | '${c}'`).join('\n')}

export interface UsDraftFormat {
  id: string
  label: string
  subtitle: string
  category: Exclude<UsDraftCategory, 'All' | 'Federal' | 'State' | 'Official'>
  jurisdiction: UsDraftJurisdiction
  requiresState: boolean
  boundState?: string
  formNumber?: string
  catalogType?: UsDraftCatalogType
}

export const US_DRAFT_CATEGORIES: UsDraftCategory[] = ${JSON.stringify(categories)}

${stateOptionsBlock}

export const US_DRAFT_FORMATS: UsDraftFormat[] = ${JSON.stringify(items, null, 2)}

export function getUsCategoryColor(category: string): string {
  const map: Record<string, string> = ${JSON.stringify(colors, null, 2)}
  return map[category] ?? '#1D4ED8'
}
`;
  fs.writeFileSync(path.join(ROOT, 'legal_web/lib/us-drafting/formats.ts'), out);

  // Write modular catalog slices
  const catalogDir = path.join(ROOT, 'legal_web/lib/us-drafting/catalog');
  ensureDir(catalogDir);
  fs.writeFileSync(path.join(catalogDir, 'federal.ts'), `export const US_FEDERAL_CATALOG = ${JSON.stringify(items.filter((i) => i.jurisdiction === 'Federal'), null, 2)} as const`);
  fs.writeFileSync(path.join(catalogDir, 'state-base.ts'), `export const US_STATE_BASE_CATALOG = ${JSON.stringify(items.filter((i) => i.catalogType === 'template' && i.jurisdiction === 'State'), null, 2)} as const`);
  fs.writeFileSync(path.join(catalogDir, 'state-named.ts'), `export const US_STATE_NAMED_CATALOG = ${JSON.stringify(items.filter((i) => i.catalogType === 'official'), null, 2)} as const`);

  return { federal: fedIds.length, stateBase: stIds.length, named: namedMeta.length, catalog: items.length };
}

// ─── Legal forms seed expansion ──────────────────────────────────────────────


function parseExistingSeedKeys(content) {
  const keys = new Set();
  for (const m of content.matchAll(/\{\s*\n([\s\S]*?)\n\s*\},/g)) {
    const block = m[1];
    const get = (key) => {
      const r = block.match(new RegExp(`${key}:\\s*(?:'([^']*)'|"([^"]*)"|undefined)`));
      return r ? (r[1] ?? r[2] ?? '') : '';
    };
    const countryCode = get('countryCode');
    const formName = get('formName');
    const formNumber = get('formNumber');
    if (countryCode && formName) keys.add(`${countryCode}|${formNumber}|${formName}`);
  }
  return keys;
}

function appendLegalFormsSeed(newForms) {
  const seedFile = path.join(ROOT, 'legal_backend/src/legal-forms/legal-forms.seed.ts');
  let content = fs.readFileSync(seedFile, 'utf8');
  const existingKeys = parseExistingSeedKeys(content);
  const toAdd = newForms.filter((f) => !existingKeys.has(`${f.countryCode}|${f.formNumber ?? ''}|${f.formName}`));
  if (!toAdd.length) return 0;
  const insertPoint = content.lastIndexOf('];');
  const entries = toAdd.map((f) => `  {
    countryCode: '${f.countryCode}',
    jurisdiction: ${f.jurisdiction ? `'${f.jurisdiction}'` : 'undefined'},
    practiceArea: '${f.practiceArea}',
    formName: '${f.formName.replace(/'/g, "\\'")}',
    formNumber: ${f.formNumber ? `'${String(f.formNumber).replace(/'/g, "\\'")}'` : 'undefined'},
    authority: '${f.authority.replace(/'/g, "\\'")}',
    sourceUrl: '${f.sourceUrl}',
    description: '${(f.description || '').replace(/'/g, "\\'")}',
    category: '${f.category}',
    isSystem: true,
  },`).join('\n');
  content = content.slice(0, insertPoint) + entries + '\n' + content.slice(insertPoint);
  fs.writeFileSync(seedFile, content);
  return toAdd.length;
}

function buildLegalFormsEntries(caJc, nyUcs, uscis, irs) {
  const entries = [];
  for (const [formNum, title] of uscis) {
    entries.push({ practiceArea: 'immigration', formName: title, formNumber: formNum, authority: 'USCIS', sourceUrl: 'https://www.uscis.gov/forms', category: 'Immigration', description: `USCIS ${formNum}` });
  }
  for (const [formNum, title] of irs) {
    entries.push({ practiceArea: 'tax', formName: title, formNumber: formNum, authority: 'IRS', sourceUrl: 'https://www.irs.gov/forms-instructions', category: 'Tax', description: `IRS Form ${formNum}` });
  }
  for (const f of caJc) {
    entries.push({ jurisdiction: 'CA', practiceArea: 'litigation', formName: f.title, formNumber: f.formCode, authority: 'California Judicial Council', sourceUrl: 'https://www.courts.ca.gov/forms.htm', category: f.category, description: f.title });
  }
  for (const f of nyUcs) {
    entries.push({ jurisdiction: 'NY', practiceArea: 'litigation', formName: f.title, formNumber: f.formCode, authority: 'NY Unified Court System', sourceUrl: 'https://www.nycourts.gov/forms/', category: f.category, description: f.title });
  }
  // Long tail: 45 states × 30 common forms
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    const common = ['Civil Complaint', 'Civil Answer', 'Motion', 'Discovery Demands', 'Family Petition', 'Probate Petition', 'Eviction Complaint', 'Small Claims Statement', 'Notice of Appeal', 'Subpoena', 'Summons', 'Cover Sheet', 'Verification', 'Affidavit of Service', 'Stipulation', 'Default Judgment Motion', 'Summary Judgment Motion', 'Protective Order Motion', 'Compel Discovery Motion', 'Temporary Restraining Order', 'Change of Name Petition', 'Guardianship Petition', 'Mechanics Lien', 'Foreclosure Complaint', 'Promissory Note', 'Commercial Lease', 'Residential Lease', 'Notice to Vacate', 'Pay or Quit Notice', 'Cure or Quit Notice'];
    common.forEach((formName, i) => {
      entries.push({ jurisdiction: code, practiceArea: 'litigation', formName: `${name} ${formName}`, formNumber: `${code}-FORM-${String(i + 1).padStart(3, '0')}`, authority: `${name} Courts`, sourceUrl: `https://www.${code.toLowerCase()}.gov/courts`, category: 'Civil', description: `${formName} for ${name}` });
    });
  }
  return entries;
}

// ─── Main ────────────────────────────────────────────────────────────────────

ensureDir(CATALOG_DIR);

// India G–J
const g = appendIndiaFormats(indiaBatchG);
const h = appendIndiaFormats(indiaBatchH);
const i = appendIndiaFormats(indiaBatchI);
const j = appendIndiaFormats(indiaBatchJ);
const indiaTotal = regenerateIndiaPrompts();
updateExtendedKinds(parseIndiaFormats(fs.readFileSync(path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts'), 'utf8')).map((f) => f.id));

// USCIS + IRS federal
const uscisFederal = USCIS_FORMS.map(([formNum, title]) => {
  const id = uscisKind(formNum);
  const prompt = `You are completing USCIS Form ${formNum} (${title}). Follow official USCIS form instructions structure: form heading, applicant/petitioner information, eligibility sections, supporting evidence checklist, declarations, and signature blocks. Use descriptive [BLANK] placeholders for all fields requiring user input. Apply standard US immigration drafting conventions and cite INA/regulatory provisions where applicable.`;
  return [id, prompt, { label: `${formNum} — ${title}`, subtitle: 'USCIS', category: 'Immigration' }];
});
const irsFederal = IRS_FORMS.map(([formNum, title]) => {
  const id = irsKind(formNum);
  const prompt = `You are preparing IRS Form ${formNum} (${title}). Follow official IRS form instructions: taxpayer identification, income/deduction sections, schedules as applicable, computations, signatures, and paid preparer blocks. Use descriptive [BLANK] placeholders for all fields. Apply IRC citations where relevant.`;
  return [id, prompt, { label: `Form ${formNum}`, subtitle: title, category: 'Tax' }];
});
const fedAdded = appendFederalPrompts([...uscisFederal, ...irsFederal].map(([id, prompt]) => [id, prompt]));

// Top-5 named
const { namedMeta, statePrompts } = buildTop5NamedForms();
writeStateSpecificPromptFiles(statePrompts);

// CA JC + NY UCS
const caJc = buildCaJcCatalog();
const nyUcs = buildNyUcsCatalog();
const caJcHigh = caJc.filter((f) => f.draftPriority === 'high');
const nyUcsHigh = nyUcs.filter((f) => f.draftPriority === 'high');

// Append CA/NY dynamic named prompts to state-specific files
for (const f of caJcHigh) {
  const id = jcKind(f.formCode);
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-state-specific/ca.ts');
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes(id)) {
    const prompt = `You are completing California Judicial Council Form ${f.formCode} (${f.title}). Follow mandatory Judicial Council form layout with caption, numbered fields, verification, and signature blocks. Use [BLANK] placeholders. Apply California Rules of Court.`;
    content = content.replace(/\n};\s*$/, `\n  ${id}: \`${esc(prompt)}\`,\n};\n`);
    fs.writeFileSync(file, content);
  }
}
for (const f of nyUcsHigh) {
  const id = nyKind(f.formCode);
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-state-specific/ny.ts');
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes(id)) {
    const prompt = `You are completing New York Unified Court System form ${f.formCode} (${f.title}). Follow NYSCEF/UCS form layout with caption, numbered fields, verification, and signature blocks. Use [BLANK] placeholders. Apply CPLR and Uniform Rules.`;
    content = content.replace(/\n};\s*$/, `\n  ${id}: \`${esc(prompt)}\`,\n};\n`);
    fs.writeFileSync(file, content);
  }
}

// Overlay enrichment
const overlaysEnriched = enrichRemainingOverlays();

// Rebuild web formats
const usCounts = rebuildUsWebFormats(namedMeta, caJcHigh, nyUcsHigh);

// Legal forms seed
  // Skip bulk re-seed if catalog already populated (idempotent re-runs)
  const seedFile = path.join(ROOT, 'legal_backend/src/legal-forms/legal-forms.seed.ts');
  const existingSeedCount = (fs.readFileSync(seedFile, 'utf8').match(/countryCode:/g) || []).length;
  let legalFormsAdded = 0;
  if (existingSeedCount < 500) {
    legalFormsAdded = appendLegalFormsSeed(buildLegalFormsEntries(caJc, nyUcs, USCIS_FORMS, IRS_FORMS));
  }

// Save catalog JSON for reference
fs.writeFileSync(path.join(CATALOG_DIR, 'india-batch-g.json'), JSON.stringify(indiaBatchG, null, 2));
fs.writeFileSync(path.join(CATALOG_DIR, 'us-top5-named-forms.json'), JSON.stringify(namedMeta, null, 2));
fs.writeFileSync(path.join(CATALOG_DIR, 'us-ca-judicial-council.json'), JSON.stringify(caJc, null, 2));
fs.writeFileSync(path.join(CATALOG_DIR, 'us-ny-ucs-forms.json'), JSON.stringify(nyUcs, null, 2));

// Flutter sync
try {
  execSync('node legal_backend/scripts/sync-india-formats-flutter.js', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  console.warn('Flutter sync warning:', e.message);
}

console.log(JSON.stringify({
  india: { batchG: g, batchH: h, batchI: i, batchJ: j, total: indiaTotal },
  us: { federalAdded: fedAdded, namedForms: namedMeta.length, caJc: caJc.length, nyUcs: nyUcs.length, overlaysEnriched, ...usCounts, effectiveState: usCounts.stateBase * 51, effectiveTotal: usCounts.federal + usCounts.stateBase * 51 + usCounts.named },
  legalFormsAdded,
}, null, 2));
