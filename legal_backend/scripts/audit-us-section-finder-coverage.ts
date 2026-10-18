/**
 * Audit US Section Finder curated coverage and priority lookups.
 *
 * Usage: npm run audit:us-section-finder
 */
import {
  US_SECTION_FINDER_BY_ACT,
  US_SECTION_FINDER_DATA,
  US_SECTION_FINDER_STATS,
  US_LAW_CURRENCY_CUTOFF,
} from '../src/legal-search/us-section-finder/us-section-finder.index';

interface AuditReport {
  ok: boolean;
  stats: typeof US_SECTION_FINDER_STATS;
  lawCurrencyCutoff: string;
  duplicateIds: string[];
  missingPriority: string[];
  missingEnrichment: string[];
}

const PRIORITY_LOOKUPS = [
  'flsa:207',
  'title-vii:2000E-2',
  'ada:12112',
  'bankruptcy-code:362',
  'ina:212',
  'usc-18:1343',
  'frcp:12',
  'fre:401',
  'ca-penal-code:187',
  'ny-penal-law:125.25',
  'tx-penal-code:19.02',
];

function audit(): AuditReport {
  const ids = US_SECTION_FINDER_DATA.map((e) => e.id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);

  const missingPriority = PRIORITY_LOOKUPS.filter((key) => !US_SECTION_FINDER_BY_ACT.has(key));

  const missingEnrichment: string[] = [];
  for (const entry of US_SECTION_FINDER_DATA) {
    if (!entry.punishment || entry.punishment.length < 5) {
      missingEnrichment.push(`${entry.id}: punishment`);
    }
    if (!entry.bailPosture || entry.bailPosture.length < 10) {
      missingEnrichment.push(`${entry.id}: bailPosture`);
    }
    if (!entry.practiceNote || entry.practiceNote.length < 10) {
      missingEnrichment.push(`${entry.id}: practiceNote`);
    }
  }

  const ok =
    duplicateIds.length === 0 &&
    missingPriority.length === 0 &&
    missingEnrichment.length === 0 &&
    US_SECTION_FINDER_STATS.total >= 150;

  return {
    ok,
    stats: US_SECTION_FINDER_STATS,
    lawCurrencyCutoff: US_LAW_CURRENCY_CUTOFF,
    duplicateIds,
    missingPriority,
    missingEnrichment,
  };
}

function main() {
  const report = audit();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error('\nUS Section Finder audit FAILED — see issues above.');
    process.exit(1);
  }
  console.log('\nUS Section Finder audit PASSED.');
}

main();
