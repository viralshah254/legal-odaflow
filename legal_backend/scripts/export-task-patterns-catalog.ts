/**
 * Export system task patterns to data/task-patterns.catalog.json (consolidated seed catalog).
 *
 * Run: npm run export:task-patterns-catalog
 */
import * as fs from 'fs';
import * as path from 'path';
import { SYSTEM_TASK_PATTERNS } from '../src/task-patterns/task-patterns.catalog';

const outPath = path.join(__dirname, '../data/task-patterns.catalog.json');

const payload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  sources: [
    'legal_web/app/app/india-drafting/page.tsx — QUICK_KINDS',
    'legal_web/messages/en.json — dashboard.aiSearch.prompts (IN/US/KE/GB)',
    'legal_web/messages/en.json — copilot.quickPrompt*',
    'legal_backend eval golden cases — maintenance revision',
    'legal_backend statute-sections.seed.ts — priority section shortcuts',
    'legal_backend statute-registry — tier-1 acts per country',
  ],
  patterns: SYSTEM_TASK_PATTERNS,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Exported ${SYSTEM_TASK_PATTERNS.length} patterns → ${outPath}`);
