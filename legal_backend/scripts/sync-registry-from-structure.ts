/**
 * Sync in.statutes.ts sectionCount, orderCount, scheduleCount from act-structure.reference.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadActStructureReference } from '../src/legal-sources/act-structure.loader';

const STATUTES_PATH = resolve(process.cwd(), 'src/legal-search/statute-registry/in.statutes.ts');

function main() {
  const ref = loadActStructureReference();
  let content = readFileSync(STATUTES_PATH, 'utf8');
  let updated = 0;

  for (const entry of Object.values(ref.acts)) {
    const registryId = entry.registryActId;
    if (!registryId) continue;

    const idPattern = new RegExp(`(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?)(sectionCount:\\s*)\\d+`, 'm');
    const match = content.match(idPattern);
    if (match) {
      content = content.replace(idPattern, `$1$2${entry.sectionCount}`);
      updated += 1;
    }

    if (entry.orderCount) {
      const orderPattern = new RegExp(
        `(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?)(orderCount:\\s*)\\d+`,
        'm',
      );
      if (orderPattern.test(content)) {
        content = content.replace(orderPattern, `$1$2${entry.orderCount}`);
      } else {
        content = content.replace(
          new RegExp(`(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?sectionCount:\\s*\\d+,)`),
          `$1\n    orderCount: ${entry.orderCount},`,
        );
      }
    }

    if (entry.scheduleCount) {
      const schedPattern = new RegExp(
        `(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?)(scheduleCount:\\s*)\\d+`,
        'm',
      );
      if (schedPattern.test(content)) {
        content = content.replace(schedPattern, `$1$2${entry.scheduleCount}`);
      } else {
        content = content.replace(
          new RegExp(`(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?sectionCount:\\s*\\d+,)`),
          `$1\n    scheduleCount: ${entry.scheduleCount},`,
        );
      }
    }

    const profile = entry.structure.structureProfile;
    if (profile) {
      const profilePattern = new RegExp(
        `(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?)(structureProfile:\\s*)'[^']*'`,
        'm',
      );
      if (profilePattern.test(content)) {
        content = content.replace(profilePattern, `$1$2'${profile}'`);
      } else {
        content = content.replace(
          new RegExp(`(id:\\s*'${registryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?sectionCount:\\s*\\d+,)`),
          `$1\n    structureProfile: '${profile}',`,
        );
      }
    }
  }

  writeFileSync(STATUTES_PATH, content);
  console.log(`[sync-registry] Updated sectionCount for ${updated} registry entries`);
}

main();
