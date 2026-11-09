/**
 * Validate India act structure: PDF parse vs reference JSON vs registry sectionCount.
 *
 *   npm run validate:india-act-structure
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { loadActStructureReference } from '../src/legal-sources/act-structure.loader';
import { parseActTextIntoProvisions } from '../src/legal-sources/parsers/india-act-structure.parser';
import { findStatuteByManifestActId } from '../src/legal-search/statute-registry';

async function main() {
  const ref = loadActStructureReference();
  const actIds = Object.keys(ref.acts);
  if (actIds.length === 0) {
    console.error('[validate] No act-structure.reference.json — run npm run generate:india-act-structure first');
    process.exit(1);
  }

  const errors: string[] = [];

  for (const manifestActId of actIds) {
    const entry = ref.acts[manifestActId];
    const pdfPath = resolve(process.cwd(), entry.sourcePdf);
    if (!existsSync(pdfPath)) {
      errors.push(`${manifestActId}: bundled PDF missing at ${entry.sourcePdf}`);
      continue;
    }

    const bytes = readFileSync(pdfPath);
    if (!entry.sourceSha256 || entry.sourceSha256 !== createHash('sha256').update(bytes).digest('hex')) {
      errors.push(`${manifestActId}: source fingerprint missing or changed; review and regenerate inventory`);
    }
    const parsed = await pdfParse(bytes);
    const { structure } = parseActTextIntoProvisions(parsed.text, {
      documentType: entry.structure.articles ? 'constitution' : 'act',
    });
    const registry = findStatuteByManifestActId(manifestActId);

    const compare = (
      label: string,
      expected: number | undefined,
      actual: number | undefined,
    ) => {
      if (expected === undefined || expected === 0) return;
      if (actual !== expected) {
        errors.push(`${manifestActId}: ${label} count ${actual} !== reference ${expected}`);
      }
    };

    compare('sections', entry.structure.sections?.count, structure.sections?.count);
    compare('articles', entry.structure.articles?.count, structure.articles?.count);
    compare('orders', entry.structure.orders?.count, structure.orders?.count);
    compare('schedules', entry.structure.schedules?.count, structure.schedules?.count);

    if (registry?.sectionCount && entry.sectionCount !== registry.sectionCount) {
      // Registry sync is best-effort until generate script updates it
      console.warn(
        `[validate] ${manifestActId}: registry sectionCount ${registry.sectionCount} != reference ${entry.sectionCount}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(`[validate] FAILED with ${errors.length} error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`[validate] PASSED — ${actIds.length} acts validated`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
