/**
 * Resumable two-phase Indian statute backfill.
 *
 * Phase 1 parses selected poor-quality manifest acts and upserts authority text
 * with embeddingStatus=PENDING. Phase 2 embeds pending authorities in bounded
 * batches and atomically replaces their chunks.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  IndiaStatuteBackfillService,
  partitionRegisteredManifestActs,
  runBounded,
  selectEmbedActIds,
  selectParseActIds,
} from '../src/legal-sources/india-statute-backfill.service';
import { loadIndiaSourcesManifest } from '../src/legal-sources/india-manifest.loader';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { resolveIngestActId } from '../src/legal-search/statute-registry';

type Phase = 'all' | 'parse' | 'embed';

function valueArg(argv: string[], name: string): string | undefined {
  return argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function numberArg(argv: string[], name: string, fallback: number): number {
  const raw = valueArg(argv, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
}

function listArg(argv: string[], name: string): string[] {
  return (valueArg(argv, name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]) {
  const phase = (argv.includes('--embed-only')
    ? 'embed'
    : valueArg(argv, 'phase') ?? 'all') as Phase;
  if (!['all', 'parse', 'embed'].includes(phase)) {
    throw new Error('--phase must be all, parse, or embed');
  }
  const threshold = numberArg(argv, 'threshold', 0.1);
  const allowedHeadingRatio = numberArg(
    argv,
    'allowed-heading-ratio',
    threshold,
  );
  if (
    threshold < 0 ||
    threshold > 1 ||
    allowedHeadingRatio < 0 ||
    allowedHeadingRatio > 1
  ) {
    throw new Error('Quality ratios must be between 0 and 1');
  }
  const actConcurrency = Math.floor(numberArg(argv, 'act-concurrency', 2));
  const embeddingConcurrency = Math.floor(
    numberArg(argv, 'embedding-concurrency', 1),
  );
  const batchSize = Math.floor(numberArg(argv, 'embedding-batch-size', 48));
  if (
    actConcurrency < 1 ||
    embeddingConcurrency < 1 ||
    batchSize < 1 ||
    batchSize > 512
  ) {
    throw new Error(
      'Concurrency must be positive and embedding batch size must be 1-512',
    );
  }
  return {
    phase,
    threshold,
    allowedHeadingRatio,
    actConcurrency,
    embeddingConcurrency,
    batchSize,
    only: listArg(argv, 'only'),
    exclude: listArg(argv, 'exclude'),
    dryRun: argv.includes('--dry-run'),
    forceReindex: argv.includes('--force-reindex'),
    purgeContaminated: argv.includes('--purge-contaminated'),
    purgeOnly: argv.includes('--purge-only'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = loadIndiaSourcesManifest();
  const { manifestByRegistryId, unregistered } =
    partitionRegisteredManifestActs(
      manifest.acts.map((entry) => entry.actId),
      (actId) => resolveIngestActId(actId, 'IN'),
    );
  if (unregistered.length > 0) {
    console.warn(
      `[backfill:india-statutes] Skipping ${unregistered.length} unregistered manifest acts ` +
        `(future sources without LegalAuthority act IDs): ${unregistered.join(', ')}`,
    );
  }

  let actIds = [...manifestByRegistryId.keys()];
  if (options.only.length > 0) {
    const only = new Set(
      options.only.map((id) => resolveIngestActId(id, 'IN') ?? id),
    );
    actIds = actIds.filter((id) => only.has(id));
  }
  const excluded = new Set(
    options.exclude.map((id) => resolveIngestActId(id, 'IN') ?? id),
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const backfill = app.get(IndiaStatuteBackfillService);
    const ingest = app.get(StatuteIngestService);
    const before = await backfill.qualitySummary(actIds);
    const parseCandidates = selectParseActIds(
      before.acts,
      options.threshold,
      excluded,
    );
    const parseActIds =
      options.phase === 'embed'
        ? []
        : options.forceReindex
          ? actIds.filter((actId) => !excluded.has(actId))
          : parseCandidates;
    const initialEmbedActIds =
      options.phase === 'parse' ? [] : selectEmbedActIds(before.acts, excluded);
    const targetActIds = [
      ...new Set([...parseActIds, ...initialEmbedActIds]),
    ];
    console.log(
      `[backfill:india-statutes] ${parseActIds.length} acts selected for parse, ` +
        `${initialEmbedActIds.length} acts selected for embedding; ` +
        `overall heading-only=${before.overall.headingOnly}/${before.overall.total} ` +
        `(${(before.overall.headingOnlyRatio * 100).toFixed(2)}%); ` +
        `pending embeddings=${before.overall.pendingEmbeddings}`,
    );

    const ingestErrors: string[] = [];
    const purgeResult =
      !options.dryRun && options.purgeContaminated
        ? await backfill.purgeContaminated(parseActIds)
        : { authorities: 0, chunks: 0, contentHashes: 0, authorityIds: [] };
    if (options.purgeContaminated) {
      console.log(
        `[backfill:india-statutes] Purged ${purgeResult.authorities} contaminated authorities, ` +
          `${purgeResult.chunks} chunks and ${purgeResult.contentHashes} content hashes`,
      );
    }
    if (
      !options.dryRun &&
      !options.purgeOnly &&
      (options.phase === 'all' || options.phase === 'parse')
    ) {
      await runBounded(
        parseActIds,
        options.actConcurrency,
        async (registryActId, index) => {
          const manifestActId = manifestByRegistryId.get(registryActId);
          if (!manifestActId) {
            ingestErrors.push(`${registryActId}: no manifest mapping`);
            return;
          }
          const startedAt = Date.now();
          console.log(
            `[backfill:india-statutes] Parse ${index + 1}/${parseActIds.length}: ${manifestActId} → ${registryActId}`,
          );
          const result = await ingest.ingestAct('IN', manifestActId, {
            deferEmbeddings: true,
            forceReindex: options.forceReindex,
          });
          ingestErrors.push(
            ...result.errors.map((error) => `${registryActId}: ${error}`),
          );
          console.log(
            `[backfill:india-statutes] Parsed ${registryActId} in ${(
              (Date.now() - startedAt) /
              1000
            ).toFixed(1)}s: changed=${result.sectionsUpserted}, ` +
              `unchanged=${result.skippedUnchanged ?? 0}, errors=${result.errors.length}`,
          );
        },
      );
    }

    let embeddingResult = {
      authorities: 0,
      chunks: 0,
      batches: 0,
      errors: [] as string[],
    };
    if (
      !options.dryRun &&
      !options.purgeOnly &&
      (options.phase === 'all' || options.phase === 'embed')
    ) {
      // Re-read selection so a restart includes healthy text whose embeddings
      // are still PENDING/FAILED/PROCESSING from an earlier parse phase.
      const preEmbed = await backfill.qualitySummary(actIds);
      const embedActIds = selectEmbedActIds(preEmbed.acts, excluded);
      embeddingResult = await backfill.embedPending(embedActIds, {
        batchSize: options.batchSize,
        concurrency: options.embeddingConcurrency,
      });
    }

    const after = options.dryRun
      ? before
      : await backfill.qualitySummary(actIds);
    const targetSet = new Set(targetActIds);
    const perAct = before.acts.map((act) => {
        const final = after.acts.find((row) => row.actId === act.actId)!;
        return {
          actId: act.actId,
          selected: targetSet.has(act.actId),
          before: {
            sections: act.total,
            headingOnly: act.headingOnly,
            ratio: Number(act.headingOnlyRatio.toFixed(4)),
            pendingEmbeddings: act.pendingEmbeddings,
          },
          after: {
            sections: final.total,
            headingOnly: final.headingOnly,
            ratio: Number(final.headingOnlyRatio.toFixed(4)),
            pendingEmbeddings: final.pendingEmbeddings,
          },
        };
      });
    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          phase: options.phase,
          forceReindex: options.forceReindex,
          purgeContaminated: options.purgeContaminated,
          purgeOnly: options.purgeOnly,
          purgeResult,
          unregisteredManifestActs: unregistered,
          selectedActs: targetActIds,
          parseCandidates,
          parseActIds,
          initialEmbedActIds,
          perAct,
          overall: {
            before: before.overall,
            after: after.overall,
          },
          embeddings: embeddingResult,
          ingestErrors,
        },
        null,
        2,
      ),
    );

    if (options.dryRun) return;
    const parseTargetSet = new Set(parseActIds);
    const poorTargets = after.acts.filter(
      (act) =>
        parseTargetSet.has(act.actId) &&
        act.headingOnlyRatio > options.allowedHeadingRatio,
    );
    const embeddingFailure =
      (options.phase === 'all' || options.phase === 'embed') &&
      (embeddingResult.errors.length > 0 ||
        after.acts.some(
          (act) => targetSet.has(act.actId) && act.pendingEmbeddings > 0,
        ));
    if (ingestErrors.length > 0 || poorTargets.length > 0 || embeddingFailure) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
