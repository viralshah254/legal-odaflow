#!/usr/bin/env node
/** Deduplicate catalog.generated.json by countryCode + jurisdiction + formNumber + formName */
const fs = require('fs');
const path = require('path');

const jsonFile = path.join(__dirname, '../src/legal-forms/catalog.data.json');
const catalog = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

const seen = new Set();
const unique = [];
for (const e of catalog) {
  const key = `${e.countryCode}|${e.jurisdiction ?? ''}|${e.formNumber ?? ''}|${e.formName}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(e);
}

fs.writeFileSync(jsonFile, JSON.stringify(unique, null, 0));
console.log(JSON.stringify({ before: catalog.length, after: unique.length, removed: catalog.length - unique.length }, null, 2));
