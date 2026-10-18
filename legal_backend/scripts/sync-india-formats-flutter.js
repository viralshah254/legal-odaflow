#!/usr/bin/env node
/** Sync INDIA_DRAFT_FORMATS from web to Flutter india_drafting_screen.dart */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const formatsFile = path.join(ROOT, 'legal_web/lib/india-drafting/formats.ts');
const dartFile = path.join(ROOT, 'legal_app/lib/features/lawyer/india_drafting/india_drafting_screen.dart');

const categoryIcons = {
  Bail: 'Icons.balance_outlined',
  Criminal: 'Icons.gavel_outlined',
  Civil: 'Icons.account_balance_outlined',
  Family: 'Icons.family_restroom_outlined',
  Constitutional: 'Icons.account_balance_outlined',
  Consumer: 'Icons.shopping_bag_outlined',
  Procedural: 'Icons.description_outlined',
  Conveyancing: 'Icons.home_work_outlined',
  Tax: 'Icons.receipt_long_outlined',
  Commercial: 'Icons.business_outlined',
  Estates: 'Icons.inventory_2_outlined',
  Labour: 'Icons.work_outlined',
  Arbitration: 'Icons.handshake_outlined',
  Insolvency: 'Icons.trending_down_outlined',
  IP: 'Icons.copyright_outlined',
  Regulatory: 'Icons.policy_outlined',
};

const content = fs.readFileSync(formatsFile, 'utf8');
const formats = [...content.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*subtitle:\s*"([^"]+)",\s*category:\s*"([^"]+)"/g)].map((m) => ({
  id: m[1],
  label: m[2],
  subtitle: m[3],
  category: m[4],
}));

const lines = formats.map((f) => {
  const icon = categoryIcons[f.category] || 'Icons.description_outlined';
  const label = f.label.replace(/'/g, "\\'");
  const subtitle = f.subtitle.replace(/'/g, "\\'");
  return `  _DraftFormat(id: '${f.id}', label: '${label}', subtitle: '${subtitle}', category: '${f.category}', icon: ${icon},),`;
});

let dart = fs.readFileSync(dartFile, 'utf8');
const start = dart.indexOf('const _formats = <_DraftFormat>[');
const end = dart.indexOf('];', start);
if (start === -1 || end === -1) throw new Error('Could not find _formats block in dart file');

dart = dart.slice(0, start) + `const _formats = <_DraftFormat>[\n${lines.join('\n')}\n` + dart.slice(end);
fs.writeFileSync(dartFile, dart);
console.log(`Synced ${formats.length} India draft formats to Flutter`);
