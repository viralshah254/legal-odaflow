#!/usr/bin/env node
/** Append missing federal court draft prompts from catalog-data/us-federal-court-forms.json */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FORMS = require('./catalog-data/us-federal-court-forms.json');
const file = path.join(ROOT, 'legal_backend/src/ai/us-draft/us-draft-prompts-federal.ts');
let content = fs.readFileSync(file, 'utf8');
const existing = new Set([...content.matchAll(/^\s+(us_[a-z0-9_]+):/gm)].map((m) => m[1]));

const adds = [];
for (const [num, name, cat] of FORMS) {
  const id = `us_federal_court_${num.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (existing.has(id)) continue;
  const prompt = `You are completing U.S. federal court form ${num} (${name}) — ${cat}. Follow official federal court form layout with caption, numbered paragraphs/fields, certificate of service, and signature blocks. Use [BLANK] placeholders. Apply FRCP/FRBP and local district rules as applicable.`;
  adds.push(`  ${id}: \`${prompt.replace(/`/g, '\\`')}\`,`);
}

if (!adds.length) {
  console.log(JSON.stringify({ added: 0, message: 'All federal court prompts present' }, null, 2));
  process.exit(0);
}

content = content.replace(/\n};\nexport const US_FEDERAL_DRAFT_KINDS/, `\n${adds.join('\n')}\n};\nexport const US_FEDERAL_DRAFT_KINDS`);
fs.writeFileSync(file, content);
console.log(JSON.stringify({ added: adds.length, totalForms: FORMS.length }, null, 2));
