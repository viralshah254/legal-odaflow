/**
 * Bulk ingest Kenya acts from corpus/ke/sources.manifest.json (Laws.Africa).
 *
 * Run:
 *   npm run build:ke-manifest          # first — requires LAWS_AFRICA_API_TOKEN
 *   npm run ingest:ke-manifest
 *   npm run ingest:ke-manifest -- --act=employment-act-2007
 *   npm run ingest:ke-manifest -- --only=constitution-ke,employment-act-2007
 *   npm run ingest:ke-manifest -- --dry-run
 *   npm run ingest:ke-manifest -- --force-reindex
 *   npm run ingest:ke-manifest -- --from-audit-report --force-reindex --delay-ms=1500
 *   npm run ingest:ke-manifest -- --from-audit-report --force-reindex --defer-embeddings
 *   npm run ingest:ke-manifest -- --from-audit-report --text-only
 *   npm run ingest:ke-manifest -- --from-unrecoverable --text-only --delay-ms=1200
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { loadKeSourcesManifest, keManifestExists } from '../src/legal-sources/ke-manifest.loader';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureKenyaLawRateLimit } from '../src/legal-sources/connectors/kenya-law-rate-limit';
import type { KeManifestActEntry } from '../src/legal-sources/ke-manifest.types';

const AUDIT_REPORT_PATH = resolve(process.cwd(), 'corpus/ke/primary-coverage-report.json');
const UNRECOVERABLE_PATH = resolve(process.cwd(), 'corpus/ke/primary-unrecoverable.json');

function minSkipForEntry(entry: KeManifestActEntry, defaultMin: number): number {
  if (entry.nature === 'legal_notice' || entry.nature === 'gazette_notice') {
    return 1;
  }
  return defaultMin;
}

function loadRecoveryActIdsFromAuditReport(): string[] {
  if (!existsSync(AUDIT_REPORT_PATH)) {
    throw new Error(
      `Audit report not found at ${AUDIT_REPORT_PATH}. Run: npm run audit:ke-primary`,
    );
  }
  const report = JSON.parse(readFileSync(AUDIT_REPORT_PATH, 'utf8')) as {
    recoveryActIds?: string[];
  };
  return (report.recoveryActIds ?? []).filter(Boolean);
}

function loadUnrecoverableActIds(): string[] {
  if (!existsSync(UNRECOVERABLE_PATH)) {
    throw new Error(
      `Unrecoverable list not found at ${UNRECOVERABLE_PATH}. Run: npm run audit:ke-primary`,
    );
  }
  const report = JSON.parse(readFileSync(UNRECOVERABLE_PATH, 'utf8')) as {
    unrecoverable?: Array<{ actId?: string } | string>;
  };
  return (report.unrecoverable ?? [])
    .map((row) => (typeof row === 'string' ? row : row.actId))
    .filter((id): id is string => Boolean(id));
}

function parseArgs(argv: string[]) {
  const act = argv.find((arg) => arg.startsWith('--act='))?.split('=')[1];
  const onlyRaw = argv.find((arg) => arg.startsWith('--only='))?.split('=')[1];
  const only = onlyRaw
    ? onlyRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;
  const dryRun = argv.includes('--dry-run');
  const forceReindex = argv.includes('--force-reindex');
  const fromAuditReport = argv.includes('--from-audit-report');
  const fromUnrecoverable = argv.includes('--from-unrecoverable');
  const textOnly = argv.includes('--text-only') || fromUnrecoverable;
  const deferEmbeddings = textOnly || argv.includes('--defer-embeddings');
  const minSkipRaw = argv.find((arg) => arg.startsWith('--min-skip='))?.split('=')[1];
  const minExistingSectionsToSkip = minSkipRaw ? parseInt(minSkipRaw, 10) : 5;
  const delayRaw = argv.find((arg) => arg.startsWith('--delay-ms='))?.split('=')[1];
  const delayMs = delayRaw ? parseInt(delayRaw, 10) : 800;
  return {
    act,
    only,
    dryRun,
    forceReindex: forceReindex || textOnly || fromUnrecoverable,
    fromAuditReport,
    fromUnrecoverable,
    deferEmbeddings,
    textOnly,
    minExistingSectionsToSkip,
    delayMs,
  };
}

async function main() {
  if (!keManifestExists()) {
    console.error(
      '[ingest:ke-manifest] corpus/ke/sources.manifest.json not found.\n' +
        'Run: npm run build:ke-manifest',
    );
    process.exit(1);
  }

  const {
    act,
    only,
    dryRun,
    forceReindex,
    fromAuditReport,
    fromUnrecoverable,
    deferEmbeddings,
    textOnly,
    minExistingSectionsToSkip,
    delayMs,
  } = parseArgs(process.argv.slice(2));
  configureKenyaLawRateLimit(delayMs);
  const manifest = loadKeSourcesManifest();
  let entries = manifest.acts;
  if (act) {
    entries = entries.filter((entry) => entry.actId === act);
  }
  let onlyIds = only;
  if (fromUnrecoverable) {
    const recoveryIds = loadUnrecoverableActIds();
    onlyIds = onlyIds?.length
      ? onlyIds.filter((id) => recoveryIds.includes(id))
      : recoveryIds;
    console.log(
      `[ingest:ke-manifest] Loaded ${recoveryIds.length} actIds from primary-unrecoverable.json (source.pdf fallback)`,
    );
  } else if (fromAuditReport) {
    const recoveryIds = loadRecoveryActIdsFromAuditReport();
    onlyIds = onlyIds?.length
      ? onlyIds.filter((id) => recoveryIds.includes(id))
      : recoveryIds;
    console.log(
      `[ingest:ke-manifest] Loaded ${recoveryIds.length} recovery actIds from audit report`,
    );
  }
  if (onlyIds?.length) {
    entries = entries.filter((entry) => onlyIds.includes(entry.actId));
  }

  console.log(
    `[ingest:ke-manifest] Loaded ${entries.length} acts from manifest` +
      (forceReindex ? ' (--force-reindex)' : '') +
      (deferEmbeddings ? ' (--defer-embeddings)' : '') +
      (textOnly ? ' (--text-only)' : '') +
      (fromUnrecoverable ? ' (--from-unrecoverable)' : '') +
      ` — ${delayMs}ms between Kenya Law requests`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const prisma = app.get(PrismaService);
    const results = [];

    for (const [index, entry] of entries.entries()) {
      if (dryRun) {
        results.push({ actId: entry.actId, title: entry.title, dryRun: true });
        continue;
      }

      if (!forceReindex) {
        const skipThreshold = minSkipForEntry(entry, minExistingSectionsToSkip);
        const existingCount = await prisma.legalAuthority.count({
          where: {
            countryCode: 'KE',
            id: { startsWith: `statute-ke-${entry.actId}-` },
          },
        });
        if (existingCount >= skipThreshold) {
          console.log(
            `[ingest:ke-manifest] Skipping "${entry.actId}" — ${existingCount} sections already indexed ` +
              `(${index + 1}/${entries.length})`,
          );
          results.push({
            countryCode: 'KE',
            actId: entry.actId,
            sectionsUpserted: 0,
            chunksStored: 0,
            connectorHits: existingCount,
            skippedUnchanged: existingCount,
            errors: [],
          });
          continue;
        }
      }

      const startedAt = Date.now();
      console.log(
        `[ingest:ke-manifest] Starting "${entry.title}" (${entry.actId}) ` +
          `(${index + 1}/${entries.length})…`,
      );
      const result = await ingest.ingestKeManifestAct(entry, {
        forceReindex,
        deferEmbeddings,
        textOnly,
      });
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[ingest:ke-manifest] Finished "${entry.actId}" in ${elapsedSec}s — ` +
          `sections=${result.sectionsUpserted}, skipped=${result.skippedUnchanged ?? 0}, ` +
          `hits=${result.connectorHits}, errors=${result.errors.length}`,
      );
      results.push(result);
    }

    console.log(JSON.stringify({ actCount: entries.length, results }, null, 2));
    const failed = results.some(
      (result) => 'errors' in result && Array.isArray(result.errors) && result.errors.length > 0,
    );
    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
