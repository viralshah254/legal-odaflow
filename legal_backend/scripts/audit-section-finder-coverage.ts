/**
 * Audit Section Finder coverage, conflicts, and law currency through June 2026.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/audit-section-finder-coverage.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { SECTION_FINDER_DATA, SECTION_FINDER_STATS } from '../src/legal-search/india-section-finder/section-finder.index';
import { IN_SECTION_REMAPS } from '../src/legal-search/statute-registry/section-remap.in';
import { AMENDMENTS_THROUGH_2026_06 } from '../src/legal-search/india-section-finder/amendments-through-2026-06.in';
import { LAW_CURRENCY_CUTOFF } from '../src/legal-search/india-section-finder/section-finder.types';
import type { IndiaSourcesManifest } from '../src/legal-sources/india-manifest.types';

const TIER1_ACTS = [
  'bns', 'bnss', 'bsa', 'ipc', 'crpc', 'iea', 'pocso-act-2012', 'ndps-act-1985',
  'pmla', 'cpc', 'negotiable-instruments',
];
const CUTOFF = LAW_CURRENCY_CUTOFF;

interface AuditReport {
  ok: boolean;
  stats: typeof SECTION_FINDER_STATS;
  remapCount: number;
  overlayCount: number;
  conflicts: string[];
  missingPriority: string[];
  currencyIssues: string[];
  commencementPending: string[];
  omittedMissing: string[];
}

function loadManifest(): IndiaSourcesManifest {
  const p = path.join(__dirname, '../corpus/in/sources.manifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')) as IndiaSourcesManifest;
}

function audit(): AuditReport {
  const conflicts: string[] = [];
  const byId = new Map(SECTION_FINDER_DATA.map(e => [e.id, e]));
  const remapByKey = new Map(IN_SECTION_REMAPS.map(r => [`${r.from.actId}:${r.from.section}`, r]));

  for (const entry of SECTION_FINDER_DATA) {
    if (entry.changeType === 'omitted') continue;
    const key = `${entry.legacyActId}:${entry.legacySection}`;
    const remap = remapByKey.get(key);
    if (remap && entry.newSection && remap.to.section !== entry.newSection) {
      conflicts.push(`${entry.id}: curated→${entry.newSection} vs remap→${remap.to.section}`);
    }
  }

  const priorityChecks = ['IPC-302', 'IPC-304', 'IPC-420', 'IPC-124A', 'IPC-376', 'CRPC-438', 'CRPC-154', 'IEA-65B', 'NI_ACT-138', 'POCSO-4', 'NDPS-20', 'PMLA-45'];
  const missingPriority = priorityChecks.filter(id => !byId.has(id));

  const manifest = loadManifest();
  const currencyIssues: string[] = [];
  for (const actId of TIER1_ACTS) {
    const act = manifest.acts.find(a => a.actId === actId);
    if (!act) {
      currencyIssues.push(`Missing manifest entry: ${actId}`);
      continue;
    }
    const lv = (act as { lastVerified?: string }).lastVerified;
    if (!lv) {
      currencyIssues.push(`${actId}: missing lastVerified`);
    } else if (lv > CUTOFF) {
      currencyIssues.push(`${actId}: lastVerified ${lv} > ${CUTOFF}`);
    }
  }

  const commencementPending = AMENDMENTS_THROUGH_2026_06
    .filter(o => o.changeType === 'commencement_pending')
    .map(o => `${o.actId} s.${o.sectionNumber}`);

  const omittedMustHave = ['IPC-124A', 'IPC-309', 'IPC-497'];
  const omittedMissing = omittedMustHave.filter(id => {
    const e = byId.get(id);
    return !e || e.changeType !== 'omitted' || e.isInForce !== false;
  });

  const ok =
    conflicts.length === 0 &&
    missingPriority.length === 0 &&
    currencyIssues.length === 0 &&
    omittedMissing.length === 0 &&
    SECTION_FINDER_STATS.total >= 350;

  return {
    ok,
    stats: SECTION_FINDER_STATS,
    remapCount: IN_SECTION_REMAPS.length,
    overlayCount: AMENDMENTS_THROUGH_2026_06.length,
    conflicts,
    missingPriority,
    currencyIssues,
    commencementPending,
    omittedMissing,
  };
}

function main() {
  const report = audit();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error('\nAudit FAILED — see issues above.');
    process.exit(1);
  }
  console.log('\nAudit PASSED.');
}

main();
