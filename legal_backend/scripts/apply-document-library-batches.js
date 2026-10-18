#!/usr/bin/env node
/** Apply document library expansion batches A–F. */
const fs = require('fs');
const path = require('path');
const batches = require('./expand-document-library-data');

const ROOT = path.resolve(__dirname, '../..');

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\$`').replace(/\$/g, '\\$').replace(/"/g, '\\"');
}

function parseIndiaFormats(content) {
  return [...content.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*subtitle:\s*"([^"]+)",\s*category:\s*"([^"]+)"/g)].map((m) => ({
    id: m[1],
    label: m[2],
    subtitle: m[3],
    category: m[4],
  }));
}

function appendIndiaFormats(newItems) {
  const file = path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set(parseIndiaFormats(content).map((f) => f.id));
  const toAdd = newItems.filter(([id]) => !existing.has(id));
  if (toAdd.length === 0) return 0;
  const entries = toAdd
    .map(([id, label, subtitle, category]) =>
      `  { id: "${id}", label: "${label.replace(/"/g, '\\"')}", subtitle: "${subtitle.replace(/"/g, '\\"')}", category: "${category}" },`,
    )
    .join('\n');
  content = content.replace(/\n\]\n\nexport function getCategoryColor/, `\n${entries}\n]\n\nexport function getCategoryColor`);
  fs.writeFileSync(file, content);
  return toAdd.length;
}

function regenerateIndiaPrompts() {
  const file = path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts');
  const formats = parseIndiaFormats(fs.readFileSync(file, 'utf8'));
  const lines = [
    '/** Auto-generated India court drafting system prompts. */',
    'export const INDIA_DRAFT_SYSTEM_PROMPTS: Record<string, string> = {',
  ];
  for (const f of formats) {
    const prompt = `You are drafting a ${f.label} under ${f.subtitle} (${f.category} practice). Apply standard Indian court drafting conventions for this document type under the cited statute/rules. Structure: court/agency heading, parties, facts, legal grounds, prayer/relief, verification/execution as applicable. Use descriptive [BLANK] placeholders. Follow DU drafting rules. Use BNS/BNSS/BSA 2023 section numbers where relevant.`;
    lines.push(`  ${f.id}: \`${esc(prompt)}\`,`);
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
  content =
    content.slice(0, start) +
    `  // ── India Court Drafting (BNS/BNSS/BSA 2023 + full practice library) ─\n${indiaIds.map((id) => `  '${id}',`).join('\n')}\n` +
    content.slice(end);
  fs.writeFileSync(file, content);
}

function appendUsFederalPrompts(items) {
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set([...content.matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]));
  const toAdd = items.filter(([id]) => !existing.has(id));
  const adds = toAdd
    .map(([id, name, statute, cat]) => {
      const p = `You are drafting a ${name} under ${statute} (${cat} — United States). Apply standard US legal drafting conventions. Use descriptive [BLANK] placeholders. Follow Bluebook citations where appropriate.`;
      return `  ${id}: \`${esc(p)}\`,`;
    })
    .join('\n');
  if (adds) {
    content = content.replace(/\n};\nexport const US_FEDERAL_DRAFT_KINDS/, `\n${adds}\n};\nexport const US_FEDERAL_DRAFT_KINDS`);
    fs.writeFileSync(file, content);
  }
  return toAdd.length;
}

function appendUsStatePrompts(items) {
  const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-state.ts');
  let content = fs.readFileSync(file, 'utf8');
  const existing = new Set([...content.matchAll(/^\s+(us_state_[a-z0-9_]+):/gm)].map((m) => m[1]));
  const toAdd = items.filter(([id]) => !existing.has(id));
  const adds = toAdd
    .map(([id, name, statute, cat]) => {
      const p = `You are drafting a ${name} under ${statute} (${cat} — United States). Apply the provided state overlay for court names, statutes, and official form references. Use descriptive [BLANK] placeholders. Follow US legal drafting conventions.`;
      return `  ${id}: \`${esc(p)}\`,`;
    })
    .join('\n');
  if (adds) {
    content = content.replace(/\n};\nexport const US_STATE_BASE_DRAFT_KINDS/, `\n${adds}\n};\nexport const US_STATE_BASE_DRAFT_KINDS`);
    fs.writeFileSync(file, content);
  }
  return toAdd.length;
}

function rebuildUsWebFormats() {
  const fedFile = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
  const stFile = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-state.ts');
  const fedIds = [...fs.readFileSync(fedFile, 'utf8').matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]);
  const stIds = [...fs.readFileSync(stFile, 'utf8').matchAll(/^\s+(us_state_[a-z0-9_]+):/gm)].map((m) => m[1]);

  const existing = fs.readFileSync(path.join(ROOT, 'legal_web/lib/us-drafting/formats.ts'), 'utf8');
  const stateOptionsBlock = existing.match(/export const US_STATE_OPTIONS = [\s\S]*? as const/)[0];
  const meta = new Map();
  for (const m of existing.matchAll(/\{\s*\n\s*"id": "([^"]+)",\s*\n\s*"label": "([^"]+)",\s*\n\s*"subtitle": "([^"]+)",\s*\n\s*"category": "([^"]+)",\s*\n\s*"jurisdiction": "([^"]+)",\s*\n\s*"requiresState": (true|false)/g)) {
    meta.set(m[1], { label: m[2], subtitle: m[3], category: m[4] });
  }

  const allBatches = [...batches.usFederalBatchD, ...batches.usStateBaseBatchE];
  for (const [id, label, subtitle, category] of allBatches) {
    if (!meta.has(id)) meta.set(id, { label, subtitle, category });
  }

  const items = [];
  for (const id of fedIds) {
    const m = meta.get(id) || { label: id, subtitle: 'Federal practice', category: 'Other' };
    items.push({ id, ...m, jurisdiction: 'Federal', requiresState: false });
  }
  for (const id of stIds) {
    const m = meta.get(id) || { label: id, subtitle: 'State practice', category: 'Civil' };
    items.push({ id, ...m, jurisdiction: 'State', requiresState: true });
  }

  const categories = ['All', 'Federal', 'State', 'Civil', 'Criminal', 'Family', 'Bankruptcy', 'Immigration', 'Tax', 'Employment', 'Administrative', 'IP', 'Constitutional', 'Probate', 'Real Estate', 'Commercial', 'Procedural', 'Other'];
  const colors = { Federal: '#1D4ED8', State: '#2563EB', Civil: '#2563EB', Criminal: '#DC2626', Family: '#059669', Bankruptcy: '#7C3AED', Immigration: '#0891B2', Tax: '#CA8A04', Employment: '#EA580C', Administrative: '#65A30D', IP: '#0284C7', Constitutional: '#9333EA', Probate: '#B45309', 'Real Estate': '#0D9488', Commercial: '#4F46E5', Procedural: '#6B7280', Other: '#6B7280' };

  const out = `export type UsDraftJurisdiction = 'Federal' | 'State'

export type UsDraftCategory =
${categories.map((c) => `  | '${c}'`).join('\n')}

export interface UsDraftFormat {
  id: string
  label: string
  subtitle: string
  category: Exclude<UsDraftCategory, 'All' | 'Federal' | 'State'>
  jurisdiction: UsDraftJurisdiction
  requiresState: boolean
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
  return { federal: fedIds.length, stateBase: stIds.length, catalog: items.length };
}

function enrichTop5StateOverlays() {
  const file = path.join(ROOT, 'legal_backend/src/config/state-overlays/overlays.ts');
  let content = fs.readFileSync(file, 'utf8');

  const top5Forms = {
    CA: {
      civil_complaint: 'Judicial Council PLD-C-001 (Complaint)',
      civil_answer: 'Judicial Council PLD-C-010 (Answer)',
      motion: 'Judicial Council MC-030 (Memorandum of Points and Authorities)',
      discovery: 'Judicial Council DISC-001/002/003',
      family: 'FL-100 (Petition—Marriage/Domestic Partnership)',
      probate: 'DE-111 (Petition for Probate)',
      eviction: 'UD-100 (Unlawful Detainer Complaint)',
      small_claims: 'SC-100 (Plaintiff Claim and ORDER)',
      localNote: 'California Rules of Court; mandatory Judicial Council forms for many proceedings.',
    },
    NY: {
      civil_complaint: 'NY Supreme Court civil complaint (no universal form; follow 22 NYCRR §202)',
      civil_answer: 'Answer with affirmative defenses per CPLR',
      motion: 'Notice of Motion + Affirmation (CPLR §2214)',
      discovery: 'CPLR Article 31 discovery demands',
      family: 'Supreme Court matrimonial summons with notice (DRL)',
      probate: 'Petition for Letters Testamentary (Surrogate Court)',
      eviction: 'Petition in Holdover Proceeding (RPAPL)',
      small_claims: 'Small Claims Assessment Review (SCAR) / local court forms',
      localNote: 'New York CPLR and Uniform Rules; e-filing via NYSCEF in many counties.',
    },
    TX: {
      civil_complaint: 'Original Petition (no statewide form; follow TRCP Rule 45)',
      civil_answer: 'Original Answer (TRCP)',
      motion: 'Motion and Brief under TRCP',
      discovery: 'TRCP Rules 190-196 discovery',
      family: 'Original Petition for Divorce (Family Code)',
      probate: 'Application for Probate of Will (Estates Code)',
      eviction: 'Forcible Detainer Petition (Property Code Ch. 24)',
      small_claims: 'Justice Court petition (Government Code Ch. 27)',
      localNote: 'Texas Rules of Civil Procedure; mandatory e-filing in many counties.',
    },
    FL: {
      civil_complaint: 'Florida Supreme Court approved family/civil forms where mandated',
      civil_answer: 'Answer to Complaint (Fla. Family Law Rules of Procedure Form)',
      motion: 'Motion (Fla. R. Gen. Prac. & Jud. Admin.)',
      discovery: 'Fla. R. Civ. P. 1.340-1.370',
      family: 'Form 12.901(a) Petition for Dissolution of Marriage',
      probate: 'Formal Administration Petition (Fla. Prob. Rules)',
      eviction: 'Complaint for Eviction (Fla. Stat. §83)',
      small_claims: 'Statement of Claim (county small claims)',
      localNote: 'Florida Family Law Rules; e-filing via Florida Courts E-Filing Portal.',
    },
    IL: {
      civil_complaint: 'Illinois Circuit Court civil complaint (735 ILCS 5/)',
      civil_answer: 'Answer and Affirmative Defenses (Ill. Sup. Ct. Rules)',
      motion: 'Motion pursuant to Ill. Sup. Ct. Rule 191',
      discovery: 'Illinois Supreme Court discovery rules',
      family: 'Petition for Dissolution of Marriage (IL Marriage and Dissolution Act)',
      probate: 'Petition for Letters of Office (Probate Act)',
      eviction: 'Forcible Entry and Detainer Complaint (735 ILCS 5/9)',
      small_claims: 'Small Claims Affidavit (735 ILCS 5/2-101)',
      localNote: 'Illinois Supreme Court Rules; Cook County has additional local requirements.',
    },
  };

  for (const [code, forms] of Object.entries(top5Forms)) {
    const marker = `    formReferences: {`;
    const blockStart = content.indexOf(`  ${code}: {`);
    if (blockStart === -1) continue;
    const formRefStart = content.indexOf(marker, blockStart);
    const formRefEnd = content.indexOf('    },', formRefStart);
    const extraRefs = Object.entries(forms)
      .filter(([k]) => k !== 'localNote')
      .map(([k, v]) => `      ${k}: '${v.replace(/'/g, "\\'")}',`)
      .join('\n');
    const localNote = forms.localNote.replace(/'/g, "\\'");
    const newBlock = `    formReferences: {\n${extraRefs}\n      official_crosswalk_note: '${localNote}',\n    },`;
    content = content.slice(0, formRefStart) + newBlock + content.slice(formRefEnd + 6);
    const notesMarker = '    proceduralNotes: [';
    const notesStart = content.indexOf(notesMarker, blockStart);
    const notesEnd = content.indexOf('    ],', notesStart);
    const newNotes = `    proceduralNotes: [\n      '${localNote}',\n      'Use official court form numbers where listed in formReferences.',\n      'Verify e-filing portal and local rules before filing.',\n    ],`;
    content = content.slice(0, notesStart) + newNotes + content.slice(notesEnd + 6);
  }

  fs.writeFileSync(file, content);
}

// Run batches
const indiaA = appendIndiaFormats(batches.indiaBatchA);
const indiaB = appendIndiaFormats(batches.indiaBatchB);
const indiaC = appendIndiaFormats(batches.indiaBatchC);
const indiaTotal = regenerateIndiaPrompts();
updateExtendedKinds(parseIndiaFormats(fs.readFileSync(path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts'), 'utf8')).map((f) => f.id));

const usFed = appendUsFederalPrompts(batches.usFederalBatchD);
const usState = appendUsStatePrompts(batches.usStateBaseBatchE);
const usCounts = rebuildUsWebFormats();
enrichTop5StateOverlays();

console.log(
  JSON.stringify(
    {
      indiaAdded: { batchA: indiaA, batchB: indiaB, batchC: indiaC, total: indiaTotal },
      usAdded: { federal: usFed, stateBase: usState, ...usCounts, effectiveState: usCounts.stateBase * 51, effectiveTotal: usCounts.federal + usCounts.stateBase * 51 },
      top5OverlaysEnriched: ['CA', 'NY', 'TX', 'FL', 'IL'],
    },
    null,
    2,
  ),
);
