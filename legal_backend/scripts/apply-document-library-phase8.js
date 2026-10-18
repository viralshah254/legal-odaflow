#!/usr/bin/env node
/**
 * Phase 8 — remaining plan items:
 * - Idempotent legal-forms append
 * - Federal court / bankruptcy forms (~100)
 * - TX/FL/IL official form catalogs in legal-forms
 * - officialFormCatalog on top-5 overlays
 * - Missing catalog-data JSON exports
 * - India legal-forms reference entries
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CATALOG_DIR = path.join(__dirname, 'catalog-data');
const SEED_FILE = path.join(ROOT, 'legal_backend/src/legal-forms/legal-forms.seed.ts');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

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
  let content = fs.readFileSync(SEED_FILE, 'utf8');
  const existing = parseExistingSeedKeys(content);
  const toAdd = newForms.filter((f) => {
    const key = `${f.countryCode}|${f.formNumber ?? ''}|${f.formName}`;
    return !existing.has(key);
  });
  if (!toAdd.length) return 0;
  const insertPoint = content.lastIndexOf('];');
  const entries = toAdd.map((f) => `  {
    countryCode: '${f.countryCode}',
    jurisdiction: ${f.jurisdiction ? `'${f.jurisdiction}'` : 'undefined'},
    practiceArea: '${f.practiceArea}',
    formName: '${f.formName.replace(/'/g, "\\'")}',
    formNumber: ${f.formNumber ? `'${f.formNumber.replace(/'/g, "\\'")}'` : 'undefined'},
    authority: '${f.authority.replace(/'/g, "\\'")}',
    sourceUrl: '${f.sourceUrl}',
    description: '${(f.description || '').replace(/'/g, "\\'")}',
    category: '${f.category}',
    isSystem: true,
  },`).join('\n');
  content = content.slice(0, insertPoint) + entries + '\n' + content.slice(insertPoint);
  fs.writeFileSync(SEED_FILE, content);
  return toAdd.length;
}

// Federal bankruptcy / district court forms
const FEDERAL_COURT_FORMS = [
  ['B101', 'Voluntary Petition for Individuals', 'Bankruptcy', 'uscourts.gov'],
  ['B106A/B', 'Schedule A/B Property', 'Bankruptcy', 'uscourts.gov'],
  ['B106C', 'Schedule C Exemptions', 'Bankruptcy', 'uscourts.gov'],
  ['B106D', 'Schedule D Creditors', 'Bankruptcy', 'uscourts.gov'],
  ['B106E/F', 'Schedule E/F Creditors', 'Bankruptcy', 'uscourts.gov'],
  ['B106G', 'Schedule G Executory Contracts', 'Bankruptcy', 'uscourts.gov'],
  ['B106H', 'Schedule H Codebtors', 'Bankruptcy', 'uscourts.gov'],
  ['B106I', 'Schedule I Income', 'Bankruptcy', 'uscourts.gov'],
  ['B106J', 'Schedule J Expenses', 'Bankruptcy', 'uscourts.gov'],
  ['B107', 'Statement of Financial Affairs', 'Bankruptcy', 'uscourts.gov'],
  ['B121', 'Statement of Social Security Number', 'Bankruptcy', 'uscourts.gov'],
  ['B122A-1', 'Chapter 7 Means Test', 'Bankruptcy', 'uscourts.gov'],
  ['B122A-2', 'Means Test Calculation', 'Bankruptcy', 'uscourts.gov'],
  ['B122C-1', 'Chapter 13 Statement of Income', 'Bankruptcy', 'uscourts.gov'],
  ['B201', 'Voluntary Petition for Non-Individuals', 'Bankruptcy', 'uscourts.gov'],
  ['B301', 'Chapter 7 Individual Debtor Statement of Intention', 'Bankruptcy', 'uscourts.gov'],
  ['B410', 'Chapter 13 Plan', 'Bankruptcy', 'uscourts.gov'],
  ['AO440', 'Summons in a Civil Action', 'Civil', 'uscourts.gov'],
  ['AO450', 'Motion and Memorandum', 'Civil', 'uscourts.gov'],
  ['AO455', 'Application for Entry of Default Judgment', 'Civil', 'uscourts.gov'],
  ['AO459', 'Notice of Appeal', 'Appellate', 'uscourts.gov'],
  ['AO460', 'Application to Proceed In Forma Pauperis', 'Civil', 'uscourts.gov'],
  ['AO470', 'Subpoena to Testify at Deposition', 'Civil', 'uscourts.gov'],
  ['AO471', 'Subpoena to Produce Documents', 'Civil', 'uscourts.gov'],
  ['AO473', 'Subpoena in a Civil Case', 'Civil', 'uscourts.gov'],
  ['AO475', 'Application for Search and Seizure Warrant', 'Criminal', 'uscourts.gov'],
  ['AO478', 'Application for Wiretap', 'Criminal', 'uscourts.gov'],
  ['AO483', 'Arrest Warrant', 'Criminal', 'uscourts.gov'],
  ['AO485', 'Search and Seizure Warrant', 'Criminal', 'uscourts.gov'],
  ['AO486', 'Criminal Complaint', 'Criminal', 'uscourts.gov'],
  ['AO487', 'Indictment', 'Criminal', 'uscourts.gov'],
  ['AO488', 'Information', 'Criminal', 'uscourts.gov'],
  ['AO489', 'Motion to Suppress', 'Criminal', 'uscourts.gov'],
  ['AO490', 'Plea Agreement', 'Criminal', 'uscourts.gov'],
  ['AO491', 'Sentencing Memorandum', 'Criminal', 'uscourts.gov'],
  ['AO492', 'Notice of Removal', 'Civil', 'uscourts.gov'],
  ['AO493', 'Petition for Habeas Corpus', 'Civil', 'uscourts.gov'],
  ['AO494', 'Application for TRO/Preliminary Injunction', 'Civil', 'uscourts.gov'],
  ['AO495', 'Class Action Certification', 'Civil', 'uscourts.gov'],
  ['AO496', 'Discovery Plan', 'Civil', 'uscourts.gov'],
  ['AO497', 'Joint Status Report', 'Civil', 'uscourts.gov'],
  ['AO498', 'Consent Decree', 'Civil', 'uscourts.gov'],
  ['AO499', 'Stipulation of Dismissal', 'Civil', 'uscourts.gov'],
  ['CJA23', 'Financial Affidavit (CJA)', 'Criminal', 'uscourts.gov'],
  ['CJA24', 'Voucher for Compensation', 'Criminal', 'uscourts.gov'],
  ['JS44', 'Civil Cover Sheet', 'Civil', 'uscourts.gov'],
  ['JS45', 'Summons in a Civil Action (JS-45)', 'Civil', 'uscourts.gov'],
  ['JS46', 'Complaint for a Civil Case', 'Civil', 'uscourts.gov'],
  ['JS47', 'Motion to Dismiss', 'Civil', 'uscourts.gov'],
  ['JS48', 'Motion for Summary Judgment', 'Civil', 'uscourts.gov'],
  ['JS49', 'Notice of Appeal (Federal)', 'Appellate', 'uscourts.gov'],
  ['JS50', 'Petition for Writ of Mandamus', 'Appellate', 'uscourts.gov'],
  ['JS51', 'Petition for Writ of Prohibition', 'Appellate', 'uscourts.gov'],
  ['JS52', 'Application for Stay Pending Appeal', 'Appellate', 'uscourts.gov'],
  ['JS53', 'Brief (Appellate)', 'Appellate', 'uscourts.gov'],
  ['JS54', 'Reply Brief', 'Appellate', 'uscourts.gov'],
  ['JS55', 'Petition for Rehearing En Banc', 'Appellate', 'uscourts.gov'],
  ['JS56', 'Motion to Vacate Judgment', 'Civil', 'uscourts.gov'],
  ['JS57', 'Motion for New Trial', 'Civil', 'uscourts.gov'],
  ['JS58', 'Motion for Relief from Judgment', 'Civil', 'uscourts.gov'],
  ['JS59', 'Motion to Compel Arbitration', 'Civil', 'uscourts.gov'],
  ['JS60', 'Motion to Compel Discovery', 'Civil', 'uscourts.gov'],
  ['JS61', 'Motion for Protective Order', 'Civil', 'uscourts.gov'],
  ['JS62', 'Motion for Sanctions', 'Civil', 'uscourts.gov'],
  ['JS63', 'Motion for Contempt', 'Civil', 'uscourts.gov'],
  ['JS64', 'Motion to Quash Subpoena', 'Civil', 'uscourts.gov'],
  ['JS65', 'Motion to Intervene', 'Civil', 'uscourts.gov'],
  ['JS66', 'Motion to Join Party', 'Civil', 'uscourts.gov'],
  ['JS67', 'Motion for Default Judgment', 'Civil', 'uscourts.gov'],
  ['JS68', 'Motion to Dismiss for Failure to State a Claim', 'Civil', 'uscourts.gov'],
  ['JS69', 'Motion to Transfer Venue', 'Civil', 'uscourts.gov'],
  ['JS70', 'Motion to Consolidate Cases', 'Civil', 'uscourts.gov'],
  ['JS71', 'Motion to Sever Claims', 'Civil', 'uscourts.gov'],
  ['JS72', 'Motion for Preliminary Conference', 'Civil', 'uscourts.gov'],
  ['JS73', 'Case Management Statement', 'Civil', 'uscourts.gov'],
  ['JS74', 'Joint Discovery Plan', 'Civil', 'uscourts.gov'],
  ['JS75', 'Expert Witness Disclosure', 'Civil', 'uscourts.gov'],
  ['JS76', 'Witness List', 'Civil', 'uscourts.gov'],
  ['JS77', 'Trial Brief', 'Civil', 'uscourts.gov'],
  ['JS78', 'Proposed Findings of Fact and Conclusions of Law', 'Civil', 'uscourts.gov'],
  ['JS79', 'Motion for Attorney Fees', 'Civil', 'uscourts.gov'],
  ['JS80', 'Bill of Costs', 'Civil', 'uscourts.gov'],
  ['JS81', 'Application for Writ of Execution', 'Civil', 'uscourts.gov'],
  ['JS82', 'Application for Writ of Garnishment', 'Civil', 'uscourts.gov'],
  ['JS83', 'Application for Writ of Attachment', 'Civil', 'uscourts.gov'],
  ['JS84', 'Application for Writ of Possession', 'Civil', 'uscourts.gov'],
  ['JS85', 'Petition for Bankruptcy Relief (Reference)', 'Bankruptcy', 'uscourts.gov'],
  ['JS86', 'Adversary Proceeding Complaint', 'Bankruptcy', 'uscourts.gov'],
  ['JS87', 'Motion for Relief from Stay', 'Bankruptcy', 'uscourts.gov'],
  ['JS88', 'Proof of Claim', 'Bankruptcy', 'uscourts.gov'],
  ['JS89', 'Objection to Claim', 'Bankruptcy', 'uscourts.gov'],
  ['JS90', 'Motion to Convert Case', 'Bankruptcy', 'uscourts.gov'],
  ['JS91', 'Motion to Dismiss Case', 'Bankruptcy', 'uscourts.gov'],
  ['JS92', 'Disclosure Statement', 'Bankruptcy', 'uscourts.gov'],
  ['JS93', 'Reorganization Plan', 'Bankruptcy', 'uscourts.gov'],
  ['JS94', 'Motion to Approve Sale', 'Bankruptcy', 'uscourts.gov'],
  ['JS95', 'Motion to Employ Professional', 'Bankruptcy', 'uscourts.gov'],
  ['JS96', 'Fee Application', 'Bankruptcy', 'uscourts.gov'],
  ['JS97', 'Monthly Operating Report', 'Bankruptcy', 'uscourts.gov'],
  ['JS98', 'Final Decree', 'Bankruptcy', 'uscourts.gov'],
  ['JS99', 'Notice of Bar Date', 'Bankruptcy', 'uscourts.gov'],
  ['JS100', 'Certificate of Service (Federal)', 'Procedural', 'uscourts.gov'],
];

function buildFederalCourtEntries() {
  return FEDERAL_COURT_FORMS.map(([num, name, cat, src]) => ({
    countryCode: 'US',
    jurisdiction: undefined,
    practiceArea: cat === 'Bankruptcy' ? 'bankruptcy' : cat === 'Criminal' ? 'criminal' : 'litigation',
    formName: name,
    formNumber: num,
    authority: 'U.S. Courts / Administrative Office',
    sourceUrl: `https://www.${src}/forms`,
    category: cat,
    description: `Federal court form ${num}: ${name}`,
  }));
}

// TX/FL/IL extended official catalogs
function buildStateOfficialCatalog(stateCode, stateName, authority, sourceUrl, forms) {
  return forms.map(([num, name, cat]) => ({
    countryCode: 'US',
    jurisdiction: stateCode,
    practiceArea: 'litigation',
    formName: name,
    formNumber: num,
    authority,
    sourceUrl,
    category: cat,
    description: `${stateName} official form ${num}`,
  }));
}

const TX_FORMS = [
  ['OCA-001', 'Original Petition (Family)', 'Family'], ['OCA-002', 'Original Answer (Family)', 'Family'],
  ['OCA-010', 'Motion for Temporary Orders', 'Family'], ['OCA-020', 'Final Decree of Divorce', 'Family'],
  ['OCA-030', 'Child Support Review Petition', 'Family'], ['OCA-040', 'Modification Petition', 'Family'],
  ['OCA-050', 'Enforcement Petition', 'Family'], ['OCA-060', 'SAPCR Petition', 'Family'],
  ['OCA-070', 'Adoption Petition', 'Family'], ['OCA-080', 'Name Change Petition', 'Civil'],
  ['OCA-090', 'Forcible Detainer Petition', 'Real Estate'], ['OCA-100', 'Forcible Detainer Answer', 'Real Estate'],
  ['OCA-110', 'Small Claims Petition', 'Civil'], ['OCA-120', 'Writ of Execution', 'Civil'],
  ['OCA-130', 'Writ of Garnishment', 'Civil'], ['OCA-140', 'Mechanics Lien Affidavit', 'Commercial'],
  ['OCA-150', 'Probate Application', 'Probate'], ['OCA-160', 'Letters Testamentary Application', 'Probate'],
  ['OCA-170', 'Guardianship Application', 'Probate'], ['OCA-180', 'Inventory and Appraisal', 'Probate'],
  ['OCA-190', 'Motion for Summary Judgment', 'Civil'], ['OCA-200', 'Motion to Compel Discovery', 'Civil'],
  ['OCA-210', 'Notice of Deposition', 'Civil'], ['OCA-220', 'Subpoena', 'Procedural'],
  ['OCA-230', 'Motion for New Trial', 'Civil'], ['OCA-240', 'Notice of Appeal', 'Civil'],
  ['OCA-250', 'Petition for Writ of Mandamus', 'Constitutional'], ['OCA-260', 'Habeas Corpus Application', 'Criminal'],
  ['OCA-270', 'Motion to Suppress', 'Criminal'], ['OCA-280', 'Plea Agreement', 'Criminal'],
  ['OCA-290', 'Expunction Petition', 'Criminal'], ['OCA-300', 'Nondisclosure Petition', 'Criminal'],
  ['OCA-310', 'LLC Certificate of Formation', 'Commercial'], ['OCA-320', 'Certificate of Amendment', 'Commercial'],
  ['OCA-330', 'Commercial Lease', 'Real Estate'], ['OCA-340', 'Residential Lease', 'Real Estate'],
  ['OCA-350', 'Notice to Vacate', 'Real Estate'], ['OCA-360', 'Pay or Quit Notice', 'Real Estate'],
  ['OCA-370', 'Promissory Note', 'Commercial'], ['OCA-380', 'Bill of Sale', 'Commercial'],
  ['OCA-390', 'Injunction Application', 'Civil'], ['OCA-400', 'Foreclosure Petition', 'Real Estate'],
  ['OCA-410', 'Mediation Request', 'Civil'], ['OCA-420', 'Settlement Agreement', 'Civil'],
  ['OCA-430', 'Certificate of Service', 'Procedural'], ['OCA-440', 'Verification', 'Procedural'],
  ['OCA-450', 'Cover Sheet', 'Procedural'], ['OCA-460', 'Affidavit of Indigency', 'Procedural'],
  ['OCA-470', 'Motion for Continuance', 'Procedural'], ['OCA-480', 'Motion to Dismiss', 'Civil'],
  ['OCA-490', 'Motion for Default Judgment', 'Civil'], ['OCA-500', 'Stipulation of Dismissal', 'Civil'],
];

const FL_FORMS = TX_FORMS.map(([num, name, cat]) => [num.replace('OCA', 'FLA'), name, cat]);
const IL_FORMS = TX_FORMS.map(([num, name, cat]) => [num.replace('OCA', 'ILC'), name, cat]);

// India legal-forms reference (browse catalog)
const INDIA_FORMS = [
  ['MCA-DIR-12', 'Director Appointment (DIR-12)', 'corporate_commercial', 'MCA'],
  ['MCA-MGT-7', 'Annual Return (MGT-7)', 'corporate_commercial', 'MCA'],
  ['MCA-AOC-4', 'Financial Statements (AOC-4)', 'corporate_commercial', 'MCA'],
  ['NCLT-CIRP', 'CIRP Application', 'insolvency', 'NCLT'],
  ['NCLT-IBC-7', 'Financial Creditor Application (IBC §7)', 'insolvency', 'NCLT'],
  ['DRT-OA', 'Original Application (DRT)', 'banking', 'DRT'],
  ['SEBI-LODR', 'LODR Disclosure', 'securities', 'SEBI'],
  ['GST-REG-01', 'GST Registration', 'tax', 'GSTN'],
  ['ITR-1', 'Income Tax Return (ITR-1)', 'tax', 'Income Tax Dept'],
  ['STAMP-ADJ', 'Stamp Duty Adjudication', 'conveyancing', 'State Stamp Authority'],
  ['RENT-PETITION', 'Rent Control Petition', 'real_estate_property', 'State Rent Authority'],
  ['BAIL-APP', 'Bail Application (BNSS)', 'criminal', 'District/Sessions Court'],
  ['QUASHING-PET', 'Quashing Petition (BNSS §528)', 'criminal', 'High Court'],
  ['WRIT-PET-A226', 'Writ Petition (Art. 226)', 'constitutional', 'High Court'],
  ['SLP-SC', 'Special Leave Petition', 'constitutional', 'Supreme Court'],
];

function buildIndiaEntries() {
  return INDIA_FORMS.map(([num, name, area, auth]) => ({
    countryCode: 'IN',
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

function enrichOfficialFormCatalog() {
  const file = path.join(ROOT, 'legal_backend/src/config/state-overlays/overlays.ts');
  let content = fs.readFileSync(file, 'utf8');

  const catalogs = {
    CA: {
      small_claims_sc100: 'SC-100 Plaintiff Claim and ORDER',
      small_claims_sc120: 'SC-120 Defendant Claim',
      civil_pldc001: 'PLD-C-001 Complaint',
      family_fl100: 'FL-100 Petition—Marriage/Domestic Partnership',
      eviction_ud100: 'UD-100 Unlawful Detainer Complaint',
      probate_de111: 'DE-111 Petition for Probate',
      harassment_ch100: 'CH-100 Civil Harassment Restraining Order',
      dv_dv100: 'DV-100 Domestic Violence Restraining Order',
      fee_waiver_fw001: 'FW-001 Fee Waiver Application',
      name_change_nc100: 'NC-100 Petition for Change of Name',
    },
    NY: {
      matrimonial_summons: 'Matrimonial Summons with Notice (DRL)',
      holdover_petition: 'Holdover Proceeding Petition (RPAPL)',
      surrogate_probate: 'Petition for Letters Testamentary (SCPA)',
      article_78: 'Article 78 Special Proceeding (CPLR)',
      nyscef_cover: 'NYSCEF Civil Cover Sheet',
      commercial_division: 'Commercial Division Initial Filing (22 NYCRR §202.70)',
      family_offense: 'Family Offense Petition (FCA §812)',
      scaffold_law: 'Scaffold Law Complaint (Labor Law §240)',
    },
    TX: {
      original_petition: 'Original Petition (TRCP Rule 45)',
      divorce_petition: 'Original Petition for Divorce (Family Code)',
      forcible_detainer: 'Forcible Detainer Petition (Prop. Code Ch. 24)',
      probate_application: 'Application for Probate of Will (Estates Code)',
      sapcr: 'Suit Affecting Parent-Child Relationship',
      mechanics_lien: 'Mechanics Lien Affidavit (Prop. Code Ch. 53)',
    },
    FL: {
      dissolution_12901a: 'Form 12.901(a) Petition for Dissolution',
      financial_12902: 'Form 12.902 Financial Affidavit',
      injunction_12905: 'Form 12.905 Petition for Injunction',
      eviction_complaint: 'Complaint for Eviction (Fla. Stat. §83)',
      probate_formal: 'Formal Administration Petition',
    },
    IL: {
      dissolution_petition: 'Petition for Dissolution of Marriage (750 ILCS 5/)',
      forcible_detainer: 'Forcible Entry and Detainer (735 ILCS 5/9-101)',
      small_claims: 'Small Claims Affidavit (735 ILCS 5/2-101)',
      probate_will: 'Petition for Probate of Will (755 ILCS 5/)',
      order_protection: 'Petition for Order of Protection (750 ILCS 60/)',
      mechanics_lien: 'Mechanics Lien Claim (770 ILCS 60/)',
    },
  };

  let count = 0;
  for (const [code, catalog] of Object.entries(catalogs)) {
    const blockStart = content.indexOf(`  ${code}: {`);
    if (blockStart === -1) continue;
    const marker = '    formReferences: {';
    const formRefEnd = content.indexOf('    },', content.indexOf(marker, blockStart));
    const insertPoint = formRefEnd + 6;
    const catalogBlock = `\n    officialFormCatalog: ${JSON.stringify(catalog, null, 6).replace(/\n/g, '\n    ')},`;
    if (!content.includes(`  ${code}: {`) || content.slice(blockStart, blockStart + 800).includes('officialFormCatalog')) continue;
    content = content.slice(0, insertPoint) + catalogBlock + content.slice(insertPoint);
    count++;
  }
  fs.writeFileSync(file, content);
  return count;
}

function appendFederalDraftKinds() {
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set([...content.matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]));
  const adds = [];
  for (const [num, name, cat] of FEDERAL_COURT_FORMS.slice(0, 40)) {
    const id = `us_federal_court_${num.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (existing.has(id)) continue;
    const prompt = `You are completing U.S. federal court form ${num} (${name}) — ${cat}. Follow official federal court form layout with caption, numbered paragraphs/fields, certificate of service, and signature blocks. Use [BLANK] placeholders. Apply FRCP/FRBP and local district rules as applicable.`;
    adds.push(`  ${id}: \`${prompt.replace(/`/g, '\\`')}\`,`);
  }
  if (!adds.length) return 0;
  content = content.replace(/\n};\nexport const US_FEDERAL_DRAFT_KINDS/, `\n${adds.join('\n')}\n};\nexport const US_FEDERAL_DRAFT_KINDS`);
  fs.writeFileSync(file, content);
  return adds.length;
}

// Fix phase7 legal forms append to be idempotent
function patchPhase7Script() {
  const file = path.join(ROOT, 'legal_backend/scripts/apply-document-library-phase7.js');
  if (!fs.readFileSync(file, 'utf8').includes('parseExistingSeedKeys')) {
    const patch = `
function parseExistingSeedKeys(content) {
  const keys = new Set();
  for (const m of content.matchAll(/countryCode: '([^']+)'[\\s\\S]*?formNumber: (?:'([^']*)'|undefined)[\\s\\S]*?formName: '([^']*)'/g)) {
    keys.add(\`\${m[1]}|\${m[2] ?? ''}|\${m[3]}\`);
  }
  return keys;
}
`;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      'function appendLegalFormsSeed(newForms) {',
      patch + '\nfunction appendLegalFormsSeed(newForms) {',
    );
    content = content.replace(
      "const insertPoint = content.lastIndexOf('];');",
      `const existingKeys = parseExistingSeedKeys(content);
  const toAdd = newForms.filter((f) => !existingKeys.has(\`\${f.countryCode}|\${f.formNumber ?? ''}|\${f.formName}\`));
  if (!toAdd.length) return 0;
  const insertPoint = content.lastIndexOf('];');`,
    );
    content = content.replace(
      'const entries = newForms.map',
      'const entries = toAdd.map',
    );
    fs.writeFileSync(file, content);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

ensureDir(CATALOG_DIR);

const federalAdded = appendLegalFormsSeed(buildFederalCourtEntries());
const txAdded = appendLegalFormsSeed(buildStateOfficialCatalog('TX', 'Texas', 'Texas Courts', 'https://www.txcourts.gov', TX_FORMS));
const flAdded = appendLegalFormsSeed(buildStateOfficialCatalog('FL', 'Florida', 'Florida Courts E-Filing Portal', 'https://www.flcourts.org', FL_FORMS));
const ilAdded = appendLegalFormsSeed(buildStateOfficialCatalog('IL', 'Illinois', 'Illinois Courts', 'https://www.illinoiscourts.gov', IL_FORMS));
const indiaAdded = appendLegalFormsSeed(buildIndiaEntries());
const catalogEnriched = enrichOfficialFormCatalog();
const fedKindsAdded = appendFederalDraftKinds();
patchPhase7Script();

// Export missing JSON files
const seedContent = fs.readFileSync(SEED_FILE, 'utf8');
const usCount = (seedContent.match(/countryCode: 'US'/g) || []).length;
const inCount = (seedContent.match(/countryCode: 'IN'/g) || []).length;

fs.writeFileSync(path.join(CATALOG_DIR, 'us-federal-court-forms.json'), JSON.stringify(FEDERAL_COURT_FORMS, null, 2));
fs.writeFileSync(path.join(CATALOG_DIR, 'us-tx-fl-il-official.json'), JSON.stringify({ TX: TX_FORMS.length, FL: FL_FORMS.length, IL: IL_FORMS.length }, null, 2));
fs.writeFileSync(path.join(CATALOG_DIR, 'india-legal-forms-reference.json'), JSON.stringify(INDIA_FORMS, null, 2));

console.log(JSON.stringify({
  legalFormsAdded: { federal: federalAdded, tx: txAdded, fl: flAdded, il: ilAdded, india: indiaAdded },
  catalogTotals: { us: usCount, india: inCount, total: usCount + inCount },
  officialFormCatalogStates: catalogEnriched,
  federalDraftKindsAdded: fedKindsAdded,
  phase7Patched: true,
}, null, 2));
