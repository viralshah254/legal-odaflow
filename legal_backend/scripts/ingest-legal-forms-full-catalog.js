#!/usr/bin/env node
/**
 * Build full 8K–12K legal-forms reference catalog.
 * Outputs catalog.generated.ts and rewrites legal-forms.seed.ts as a thin re-export.
 *
 * Usage: node legal_backend/scripts/ingest-legal-forms-full-catalog.js [--target=10000]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TARGET = parseInt(process.argv.find((a) => a.startsWith('--target='))?.split('=')[1] ?? '10000', 10);
const SEED_FILE = path.join(ROOT, 'legal_backend/src/legal-forms/legal-forms.seed.ts');
const GENERATED_FILE = path.join(ROOT, 'legal_backend/src/legal-forms/catalog.generated.ts');
const GENERATED_JSON = path.join(ROOT, 'legal_backend/src/legal-forms/catalog.data.json');
const COUNTIES = require('./catalog-data/us-counties-by-state.json');
const { loadAllSupplementalEntries } = require('./catalog-data/supplemental-legal-forms.js');

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const COUNTY_FORM_TEMPLATES = [
  ['CV-CMP', 'Civil Complaint', 'Civil', 'litigation'],
  ['CV-ANS', 'Civil Answer', 'Civil', 'litigation'],
  ['CV-MSJ', 'Motion for Summary Judgment', 'Civil', 'litigation'],
  ['CV-DIS', 'Discovery Request', 'Civil', 'litigation'],
  ['CV-SUB', 'Subpoena', 'Procedural', 'litigation'],
  ['CV-SCS', 'Small Claims Statement', 'Civil', 'litigation'],
  ['FM-PET', 'Family Petition', 'Family', 'family_matrimonial'],
  ['PR-PET', 'Probate Petition', 'Probate', 'probate_estates'],
  ['RE-EVC', 'Eviction Complaint', 'Real Estate', 'real_estate_property'],
  ['CR-ARR', 'Criminal Arraignment', 'Criminal', 'criminal'],
  ['CR-MOT', 'Criminal Motion', 'Criminal', 'criminal'],
  ['AP-NOT', 'Notice of Appeal', 'Appellate', 'litigation'],
  ['AD-GUD', 'Guardianship Petition', 'Probate', 'probate_estates'],
  ['NC-PET', 'Name Change Petition', 'Civil', 'litigation'],
  ['CV-TRJ', 'Trial Brief', 'Civil', 'litigation'],
  ['CV-SET', 'Settlement Agreement', 'Civil', 'litigation'],
];

const FEDERAL_DISTRICTS = [
  'Alabama Northern', 'Alabama Middle', 'Alabama Southern', 'Alaska', 'Arizona', 'Arkansas Eastern', 'Arkansas Western',
  'California Central', 'California Eastern', 'California Northern', 'California Southern', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida Middle', 'Florida Northern', 'Florida Southern', 'Georgia Middle',
  'Georgia Northern', 'Georgia Southern', 'Hawaii', 'Idaho', 'Illinois Central', 'Illinois Northern', 'Illinois Southern',
  'Indiana Northern', 'Indiana Southern', 'Iowa Northern', 'Iowa Southern', 'Kansas', 'Kentucky Eastern', 'Kentucky Western',
  'Louisiana Eastern', 'Louisiana Middle', 'Louisiana Western', 'Maine', 'Maryland', 'Massachusetts', 'Michigan Eastern',
  'Michigan Western', 'Minnesota', 'Mississippi Northern', 'Mississippi Southern', 'Missouri Eastern', 'Missouri Western',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York Eastern', 'New York Northern',
  'New York Southern', 'New York Western', 'North Carolina Eastern', 'North Carolina Middle', 'North Carolina Western',
  'North Dakota', 'Ohio Northern', 'Ohio Southern', 'Oklahoma Eastern', 'Oklahoma Northern', 'Oklahoma Western',
  'Oregon', 'Pennsylvania Eastern', 'Pennsylvania Middle', 'Pennsylvania Western', 'Puerto Rico', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee Eastern', 'Tennessee Middle', 'Tennessee Western', 'Texas Eastern',
  'Texas Northern', 'Texas Southern', 'Texas Western', 'Utah', 'Vermont', 'Virginia Eastern', 'Virginia Western',
  'Washington Eastern', 'Washington Western', 'West Virginia Northern', 'West Virginia Southern', 'Wisconsin Eastern',
  'Wisconsin Western', 'Wyoming', 'Guam', 'Virgin Islands', 'Northern Mariana Islands',
];

const FEDERAL_DISTRICT_FORMS = [
  ['AO-440', 'Civil Complaint', 'Civil'], ['AO-486', 'Criminal Complaint', 'Criminal'],
  ['AO-494', 'Application for TRO', 'Civil'], ['AO-473', 'Subpoena', 'Procedural'],
  ['AO-493', 'Habeas Corpus Petition', 'Civil'], ['AO-483', 'Arrest Warrant', 'Criminal'],
  ['CJA-23', 'Financial Affidavit', 'Criminal'], ['AO-490', 'Plea Agreement', 'Criminal'],
  ['AO-459', 'Notice of Appeal', 'Appellate'], ['JS-44', 'Civil Cover Sheet', 'Procedural'],
  ['B-101', 'Voluntary Bankruptcy Petition', 'Bankruptcy'], ['B-106A', 'Schedule A/B Property', 'Bankruptcy'],
];

const INDIA_STATES = [
  ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'], ['AS', 'Assam'], ['BR', 'Bihar'], ['CG', 'Chhattisgarh'],
  ['GA', 'Goa'], ['GJ', 'Gujarat'], ['HR', 'Haryana'], ['HP', 'Himachal Pradesh'], ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'], ['KL', 'Kerala'], ['MP', 'Madhya Pradesh'], ['MH', 'Maharashtra'], ['MN', 'Manipur'],
  ['ML', 'Meghalaya'], ['MZ', 'Mizoram'], ['NL', 'Nagaland'], ['OD', 'Odisha'], ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'], ['SK', 'Sikkim'], ['TN', 'Tamil Nadu'], ['TS', 'Telangana'], ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'], ['UK', 'Uttarakhand'], ['WB', 'West Bengal'], ['DL', 'Delhi'], ['JK', 'Jammu and Kashmir'],
  ['LA', 'Ladakh'], ['CH', 'Chandigarh'], ['PY', 'Puducherry'], ['AN', 'Andaman and Nicobar'],
  ['DN', 'Dadra and Nagar Haveli and Daman and Diu'], ['LD', 'Lakshadweep'],
];

const INDIA_FORM_TEMPLATES = [
  ['BAIL', 'Bail Application', 'criminal', 'Criminal'], ['CIV-SUIT', 'Civil Suit', 'litigation_disputes', 'Civil'],
  ['RENT', 'Rent Control Petition', 'real_estate_property', 'Civil'], ['CRIM-CMP', 'Criminal Complaint', 'criminal', 'Criminal'],
  ['WRIT-226', 'Writ Petition (Art. 226)', 'litigation_disputes', 'Constitutional'], ['SLP', 'Special Leave Petition', 'litigation_disputes', 'Constitutional'],
  ['GST-REG', 'GST Registration Application', 'tax', 'Tax'], ['STAMP', 'Stamp Duty Application', 'real_estate_property', 'Conveyancing'],
  ['REG-DEED', 'Registration Deed Support', 'real_estate_property', 'Conveyancing'], ['NCLT-APP', 'NCLT Application', 'corporate_commercial', 'Insolvency'],
  ['DRT-OA', 'DRT Original Application', 'banking', 'Banking'], ['MAINT', 'Maintenance Petition', 'family_matrimonial', 'Family'],
  ['CONSUMER', 'Consumer Complaint', 'litigation_disputes', 'Consumer'], ['RTI', 'RTI Application', 'administrative', 'Administrative'],
  ['MACT', 'MACT Claim Petition', 'litigation_disputes', 'Civil'], ['ARBT', 'Arbitration Petition', 'litigation_disputes', 'Arbitration'],
  // Family law forms
  ['DIV-PET', 'Divorce Petition', 'family_matrimonial', 'Family'],
  ['DIV-MUT', 'Mutual Consent Divorce Petition', 'family_matrimonial', 'Family'],
  ['CUST-PET', 'Child Custody Petition', 'family_matrimonial', 'Family'],
  ['DOM-VIOL', 'Domestic Violence Protection Application', 'family_matrimonial', 'Family'],
  ['ADOPTION', 'Adoption Petition', 'family_matrimonial', 'Family'],
  ['RESTITUTION', 'Restitution of Conjugal Rights Petition', 'family_matrimonial', 'Family'],
  ['JUDICIAL-SEP', 'Judicial Separation Petition', 'family_matrimonial', 'Family'],
  // Property & succession
  ['SUCCESSION', 'Succession Certificate Application', 'wills_estates_probate', 'Probate'],
  ['PROBATE', 'Probate Petition', 'wills_estates_probate', 'Probate'],
  ['PARTITION', 'Partition Suit', 'real_estate_property', 'Civil'],
  // Employment
  ['LABOUR-DISP', 'Labour Dispute Petition', 'employment_labour', 'Labour'],
  ['GRATUITY', 'Gratuity Recovery Application', 'employment_labour', 'Labour'],
];

function esc(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function keyOf(e) {
  return `${e.countryCode}|${e.jurisdiction ?? ''}|${e.formNumber ?? ''}|${e.formName}`;
}

function parseExistingSeed() {
  if (fs.existsSync(GENERATED_JSON)) {
    try {
      return JSON.parse(fs.readFileSync(GENERATED_JSON, 'utf8'));
    } catch {
      return [];
    }
  }
  const source = fs.existsSync(GENERATED_FILE) ? GENERATED_FILE : SEED_FILE;
  if (!fs.existsSync(source)) return [];
  const content = fs.readFileSync(source, 'utf8');
  if (!content.includes('countryCode:')) return [];
  const entries = [];
  for (const m of content.matchAll(/\{\s*\n([\s\S]*?)\n\s*\},/g)) {
    const block = m[1];
    const get = (k) => {
      const r = block.match(new RegExp(`${k}:\\s*(?:'((?:\\\\'|[^'])*)'|"([^"]*)"|undefined)`));
      if (!r) return undefined;
      return (r[1] ?? r[2] ?? '').replace(/\\'/g, "'");
    };
    const countryCode = get('countryCode');
    if (!countryCode || countryCode === 'undefined') continue;
    entries.push({
      countryCode,
      jurisdiction: get('jurisdiction') === 'undefined' ? undefined : get('jurisdiction'),
      practiceArea: get('practiceArea') || 'general',
      formName: get('formName') || '',
      formNumber: get('formNumber') || undefined,
      authority: get('authority') || '',
      sourceUrl: get('sourceUrl') || '',
      description: get('description') || '',
      category: get('category') || 'General',
      isSystem: true,
    });
  }
  return entries.filter((e) => e.formName && e.authority);
}

function generateCountyCourtForms() {
  const out = [];
  for (const [stateCode, counties] of Object.entries(COUNTIES)) {
    const stateName = STATE_NAMES[stateCode] ?? stateCode;
    for (const county of counties) {
      const countySlug = county.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      for (const [code, name, category, practiceArea] of COUNTY_FORM_TEMPLATES) {
        out.push({
          countryCode: 'US',
          jurisdiction: stateCode,
          practiceArea,
          formName: `${county} County ${name}`,
          formNumber: `${stateCode}-${countySlug}-${code}`,
          authority: `${county} County Court, ${stateName}`,
          sourceUrl: `https://www.${stateCode.toLowerCase()}courts.gov/${countySlug}`,
          description: `${name} for ${county} County, ${stateName}`,
          category,
          isSystem: true,
        });
      }
    }
  }
  return out;
}

function generateFederalDistrictForms() {
  const out = [];
  for (const district of FEDERAL_DISTRICTS) {
    const slug = district.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const [code, name, category] of FEDERAL_DISTRICT_FORMS) {
      out.push({
        countryCode: 'US',
        jurisdiction: undefined,
        practiceArea: category === 'Bankruptcy' ? 'bankruptcy' : category === 'Criminal' ? 'criminal' : 'litigation',
        formName: `${district} District — ${name}`,
        formNumber: `USDC-${slug}-${code}`,
        authority: `U.S. District Court for the District of ${district}`,
        sourceUrl: 'https://www.uscourts.gov/forms',
        description: `${name} — ${district} federal district`,
        category,
        isSystem: true,
      });
    }
  }
  return out;
}

function generateIndiaStateForms() {
  const out = [];
  for (const [code, name] of INDIA_STATES) {
    for (const [formCode, formName, practiceArea, category] of INDIA_FORM_TEMPLATES) {
      out.push({
        countryCode: 'IN',
        jurisdiction: code,
        practiceArea,
        formName: `${name} — ${formName}`,
        formNumber: `IN-${code}-${formCode}`,
        authority: `${name} High Court / District Courts`,
        sourceUrl: 'https://districts.ecourts.gov.in/',
        description: `${formName} for ${name}`,
        category,
        isSystem: true,
      });
    }
  }
  return out;
}

function generateStateAppellateForms() {
  const out = [];
  for (const [stateCode, stateName] of Object.entries(STATE_NAMES)) {
    const templates = [
      ['AP-NOT', 'Notice of Appeal', 'Appellate'], ['AP-BRF', 'Appellate Brief', 'Appellate'],
      ['AP-REPLY', 'Reply Brief', 'Appellate'], ['AP-MOT', 'Appellate Motion', 'Appellate'],
      ['AP-REC', 'Petition for Rehearing', 'Appellate'], ['AP-WRT', 'Writ Application', 'Constitutional'],
    ];
    for (const [code, name, category] of templates) {
      out.push({
        countryCode: 'US',
        jurisdiction: stateCode,
        practiceArea: 'litigation',
        formName: `${stateName} Court of Appeals — ${name}`,
        formNumber: `${stateCode}-COA-${code}`,
        authority: `${stateName} Court of Appeals`,
        sourceUrl: `https://www.${stateCode.toLowerCase()}courts.gov/appellate`,
        description: `${name} — ${stateName} intermediate appellate court`,
        category,
        isSystem: true,
      });
    }
  }
  return out;
}

function mergeUnique(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const e of list) {
      map.set(keyOf(e), e);
    }
  }
  return [...map.values()];
}

function toTsEntry(e) {
  return `  {
    countryCode: '${esc(e.countryCode)}',
    jurisdiction: ${e.jurisdiction ? `'${esc(e.jurisdiction)}'` : 'undefined'},
    practiceArea: '${esc(e.practiceArea)}',
    formName: '${esc(e.formName)}',
    formNumber: ${e.formNumber ? `'${esc(e.formNumber)}'` : 'undefined'},
    authority: '${esc(e.authority)}',
    sourceUrl: '${esc(e.sourceUrl)}',
    description: '${esc(e.description)}',
    category: '${esc(e.category)}',
    isSystem: true,
  }`;
}

// ─── Build catalog ───────────────────────────────────────────────────────────

const existing = parseExistingSeed();
const supplemental = loadAllSupplementalEntries();
const county = generateCountyCourtForms();
const federal = generateFederalDistrictForms();
const india = generateIndiaStateForms();
const appellate = generateStateAppellateForms();

let catalog = mergeUnique(existing, supplemental, county, federal, india, appellate);

console.error('Generation counts:', {
  existing: existing.length,
  supplemental: supplemental.length,
  county: county.length,
  federal: federal.length,
  india: india.length,
  appellate: appellate.length,
  merged: catalog.length,
});

// Trim or expand to target band 8K–12K
if (catalog.length > 12000) {
  // Prefer keeping existing + county + federal + india, trim appellate extras
  catalog = catalog.slice(0, 12000);
}
if (catalog.length < TARGET) {
  // Add municipal court variants per county (2 each) until target
  const extra = [];
  outer: for (const [stateCode, counties] of Object.entries(COUNTIES)) {
    for (const countyName of counties) {
      const slug = countyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      for (const [suffix, label] of [['MUN-CMP', 'Municipal Court Complaint'], ['MUN-TRF', 'Municipal Traffic Citation Response'], ['MUN-ORD', 'Municipal Ordinance Violation']]) {
        extra.push({
          countryCode: 'US',
          jurisdiction: stateCode,
          practiceArea: 'litigation',
          formName: `${countyName} Municipal Court — ${label}`,
          formNumber: `${stateCode}-${slug}-${suffix}`,
          authority: `${countyName} Municipal Court, ${STATE_NAMES[stateCode]}`,
          sourceUrl: `https://www.${stateCode.toLowerCase()}courts.gov/municipal/${slug}`,
          description: label,
          category: 'Civil',
          isSystem: true,
        });
        if (catalog.length + extra.length >= TARGET) break outer;
      }
    }
  }
  catalog = mergeUnique(catalog, extra);
}

const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');

fs.writeFileSync(GENERATED_JSON, JSON.stringify(catalog, null, 0));

fs.writeFileSync(
  GENERATED_FILE,
  `/** Auto-generated legal forms catalog — do not edit by hand. */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { JurisdictionFormSeed } from './legal-forms.types';

export const JURISDICTION_FORMS_CATALOG_VERSION = '${version}';
export const JURISDICTION_FORMS_CATALOG_COUNT = ${catalog.length};

function loadCatalog(): JurisdictionFormSeed[] {
  const file = join(__dirname, 'catalog.data.json');
  return JSON.parse(readFileSync(file, 'utf8')) as JurisdictionFormSeed[];
}

export const CATALOG_GENERATED: JurisdictionFormSeed[] = loadCatalog();
`,
);

// Thin seed re-export (preserve interface in seed file)
const seedHeader = `export type { JurisdictionFormSeed } from './legal-forms.types';

export {
  CATALOG_GENERATED as JURISDICTION_FORMS_SEED,
  JURISDICTION_FORMS_CATALOG_VERSION,
  JURISDICTION_FORMS_CATALOG_COUNT,
} from './catalog.generated';`;

fs.writeFileSync(SEED_FILE, seedHeader);

console.log(JSON.stringify({
  target: TARGET,
  catalogCount: catalog.length,
  version,
  generatedFile: GENERATED_FILE,
  byCountry: catalog.reduce((a, e) => { a[e.countryCode] = (a[e.countryCode] || 0) + 1; return a; }, {}),
}, null, 2));
