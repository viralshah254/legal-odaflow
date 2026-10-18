/**
 * Audit taxonomy coverage vs task patterns catalog.
 * Run: npm run audit:taxonomy-coverage [-- --strict]
 */
import { SYSTEM_TASK_PATTERNS } from '../src/task-patterns/task-patterns.catalog';
import {
  buildCoverageMatrix,
  coverageSummary,
  missingCells,
  passesCoverageGate,
  COVERAGE_GATE_PCT,
} from '../src/config/taxonomy/coverage-matrix';

const strict = process.argv.includes('--strict');

const patternInputs = SYSTEM_TASK_PATTERNS.map((p) => ({
  domainSlug: p.domainSlug,
  jurisdiction: p.jurisdiction,
  targetFeature: p.targetFeature,
}));

const cells = buildCoverageMatrix(patternInputs);
const summary = coverageSummary(cells);
const missing = missingCells(cells);

console.log('Platform taxonomy coverage audit');
console.log('================================');
console.log(`Total cells: ${summary.total}`);
console.log(`Full: ${summary.full} (${summary.pctFull}%)`);
console.log(`Partial: ${summary.partial}`);
console.log(`Missing: ${summary.missing}`);
console.log(`Gate threshold: ${COVERAGE_GATE_PCT}%`);
console.log('');

if (missing.length > 0 && missing.length <= 40) {
  console.log('Missing cells (sample):');
  for (const cell of missing.slice(0, 40)) {
    console.log(`  - ${cell.jurisdiction} / ${cell.feature} / ${cell.domainSlug}`);
  }
  if (missing.length > 40) {
    console.log(`  ... and ${missing.length - 40} more`);
  }
}

const pass = passesCoverageGate(cells);
if (strict && !pass) {
  console.error(`\nFAIL: coverage ${summary.pctFull}% is below gate ${COVERAGE_GATE_PCT}%`);
  process.exit(1);
}

console.log(`\n${pass ? 'PASS' : 'WARN'}: coverage gate ${pass ? 'met' : 'not met (run without --strict to allow)'}`);
