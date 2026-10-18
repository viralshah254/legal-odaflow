/**
 * Validates system template library seeds for tier-1 coverage and syntax.
 * Run: npm run validate:templates
 */
import { TEMPLATE_LIBRARY_SEEDS } from '../src/config/templates/build-seeds';
import { ALL_DOCUMENT_KINDS } from '../src/config/templates/document-kinds';
import { JURISDICTION_TEMPLATE_SEEDS } from '../src/config/jurisdiction-clause-library.seed';
import { getClauseRulesForKind } from '../src/config/template-clause-rules';

const TIER1 = ['IN', 'US', 'KE', 'GB'] as const;
const IF_SYNTAX = /\[\[if:[^\]]+\]\][\s\S]*?\[\[\/if\]\]/g;
const BROKEN_IF = /\[\[if:[^\]]*$/m;

/** Minimum HTML word count (strip tags) for tier-1 binding agreement kinds. */
const MIN_WORD_COUNT: Record<string, number> = {
  employment_contract: 800,
  service_agreement: 400,
  prenuptial_agreement: 250,
  residential_lease: 200,
  share_purchase_agreement: 200,
};

let errors = 0;

function fail(msg: string) {
  console.error(`ERROR: ${msg}`);
  errors += 1;
}

function wordCount(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;
}

const kindsByCountry = new Map<string, Set<string>>();
const maxWordsByKind = new Map<string, number>();

for (const seed of TEMPLATE_LIBRARY_SEEDS) {
  if (!kindsByCountry.has(seed.countryCode)) {
    kindsByCountry.set(seed.countryCode, new Set());
  }
  kindsByCountry.get(seed.countryCode)!.add(seed.documentKind);

  const wc = wordCount(seed.content);
  const prev = maxWordsByKind.get(seed.documentKind) ?? 0;
  if (wc > prev) maxWordsByKind.set(seed.documentKind, wc);

  if (!seed.content.includes('{{clientName}}')) {
    fail(`${seed.name}: missing {{clientName}} token`);
  }
  if (!seed.content.includes('Draft for attorney review')) {
    fail(`${seed.name}: missing attorney review disclaimer`);
  }
  if (BROKEN_IF.test(seed.content)) {
    fail(`${seed.name}: unclosed [[if:]] block`);
  }
  const matches = seed.content.match(IF_SYNTAX);
  if (matches) {
    for (const block of matches) {
      if (!block.includes('[[/if]]')) {
        fail(`${seed.name}: malformed conditional block`);
      }
    }
  }

  const rules = getClauseRulesForKind(seed.documentKind);
  if (rules.length < 3) {
    fail(`${seed.name}: documentKind "${seed.documentKind}" has fewer than 3 clause rules`);
  }
}

for (const country of TIER1) {
  if (!kindsByCountry.has(country)) {
    fail(`No templates seeded for country ${country}`);
    continue;
  }
  for (const kind of ALL_DOCUMENT_KINDS) {
    if (!kindsByCountry.get(country)!.has(kind)) {
      fail(`Country ${country} missing document kind "${kind}"`);
    }
  }
}

const uniqueKindsInSeeds = new Set(TEMPLATE_LIBRARY_SEEDS.map((s) => s.documentKind));
for (const kind of ALL_DOCUMENT_KINDS) {
  if (!uniqueKindsInSeeds.has(kind)) {
    fail(`Document kind "${kind}" missing from general library seeds`);
  }
}

for (const [kind, minWords] of Object.entries(MIN_WORD_COUNT)) {
  const maxWc = maxWordsByKind.get(kind) ?? 0;
  if (maxWc < minWords) {
    fail(
      `Kind "${kind}" max word count ${maxWc} below minimum ${minWords} (tier-1 depth gate)`,
    );
  }
}

console.log(`General library: ${TEMPLATE_LIBRARY_SEEDS.length} templates`);
console.log(`Jurisdiction library: ${JURISDICTION_TEMPLATE_SEEDS.length} templates`);
console.log(`Countries: ${[...kindsByCountry.keys()].join(', ')}`);
console.log(`Unique kinds: ${uniqueKindsInSeeds.size}`);
console.log(`Canonical kinds: ${ALL_DOCUMENT_KINDS.length}`);
console.log(
  `Employment max words: ${maxWordsByKind.get('employment_contract') ?? 0}`,
);

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('\nTemplate library validation passed.');
