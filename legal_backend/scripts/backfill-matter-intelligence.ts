/**
 * Backfill matterProfile + matterGraph + matterTaskGraph on existing Matters and ConsumerCases.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/backfill-matter-intelligence.ts --dry-run
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/backfill-matter-intelligence.ts --limit=100
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/backfill-matter-intelligence.ts --offset=100 --limit=100
 *
 * Progress is logged every --progress-every=N records (default 25).
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { MatterIntelligenceService } from '../src/ai/matter-intelligence/matter-intelligence.service';
import { ConfidenceGateService } from '../src/ai/matter-intelligence/confidence-gate.service';
import { MatterGraphExtractorService } from '../src/ai/matter-intelligence/matter-graph-extractor.service';
import { MatterTaskGraphService } from '../src/ai/matter-intelligence/matter-task-graph.service';
import { DocumentDependencyService } from '../src/ai/matter-intelligence/document-dependency.service';

const prisma = new PrismaClient();

function parseArg(name: string): number | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const n = parseInt(arg.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const limit = parseArg('limit');
const offset = parseArg('offset') ?? 0;
const progressEvery = parseArg('progress-every') ?? 25;

const classifier = new MatterIntelligenceService(
  { isProviderConfigured: () => false } as never,
  new ConfidenceGateService(),
);
const graphExtractor = new MatterGraphExtractorService(
  { isProviderConfigured: () => false } as never,
);
const taskGraphBuilder = new MatterTaskGraphService(new DocumentDependencyService());

const consumerCaseWhere = {
  facts: { not: null },
  matterProfile: { equals: Prisma.DbNull },
} satisfies Prisma.ConsumerCaseWhereInput;

const matterWhere = {
  factsSummary: { not: null },
  matterProfile: { equals: Prisma.DbNull },
} satisfies Prisma.MatterWhereInput;

function logProgress(
  label: string,
  processed: number,
  total: number,
  detail?: string,
) {
  const pct = total > 0 ? ((processed / total) * 100).toFixed(1) : '100.0';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${label}] ${processed}/${total} (${pct}%)${suffix}`);
}

async function backfillConsumerCases() {
  const total = await prisma.consumerCase.count({ where: consumerCaseWhere });
  const batchSize = limit ?? total - offset;
  const targetTotal = Math.min(Math.max(total - offset, 0), batchSize);

  console.log(
    `\nConsumer cases: ${targetTotal} to process (matched=${total}, offset=${offset}${limit != null ? `, limit=${limit}` : ''}).`,
  );

  if (targetTotal === 0) return { processed: 0, skipped: 0, updated: 0 };

  const cases = await prisma.consumerCase.findMany({
    where: consumerCaseWhere,
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
    select: { id: true, facts: true, countryCode: true, jurisdiction: true },
  });

  let processed = 0;
  let skipped = 0;
  let updated = 0;

  for (const c of cases) {
    processed += 1;
    const facts = c.facts?.trim();
    if (!facts) {
      skipped += 1;
      continue;
    }

    const { profile } = classifier.classifyHeuristic(
      facts,
      c.countryCode ?? 'IN',
      c.jurisdiction ?? undefined,
    );
    const graph = await graphExtractor.extract(facts);
    const taskGraph = taskGraphBuilder.build(profile, graph);
    const detail = `${c.id.slice(0, 8)}… ${profile.practiceArea}/${profile.subPracticeArea ?? '—'}`;

    if (dryRun) {
      if (processed === 1 || processed % progressEvery === 0 || processed === cases.length) {
        logProgress('dry-run cases', processed, cases.length, detail);
      } else if (process.argv.includes('--verbose')) {
        console.log(`[dry-run] case ${c.id}: ${profile.practiceArea}/${profile.subPracticeArea ?? '—'}`);
      }
      updated += 1;
      continue;
    }

    await prisma.consumerCase.update({
      where: { id: c.id },
      data: {
        matterProfile: profile as object,
        matterGraph: graph as object,
        matterTaskGraph: taskGraph as object,
      },
    });
    updated += 1;

    if (processed % progressEvery === 0 || processed === cases.length) {
      logProgress('cases', processed, cases.length, detail);
    }
  }

  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${updated} consumer cases; skipped ${skipped} (empty facts).`,
  );
  return { processed, skipped, updated };
}

async function backfillMatters() {
  const total = await prisma.matter.count({ where: matterWhere });
  const batchSize = limit ?? total - offset;
  const targetTotal = Math.min(Math.max(total - offset, 0), batchSize);

  console.log(
    `\nMatters: ${targetTotal} to process (matched=${total}, offset=${offset}${limit != null ? `, limit=${limit}` : ''}).`,
  );

  if (targetTotal === 0) return { processed: 0, skipped: 0, updated: 0 };

  const matters = await prisma.matter.findMany({
    where: matterWhere,
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
    select: { id: true, factsSummary: true, countryCode: true, jurisdiction: true },
  });

  let processed = 0;
  let skipped = 0;
  let updated = 0;

  for (const m of matters) {
    processed += 1;
    const facts = m.factsSummary?.trim();
    if (!facts) {
      skipped += 1;
      continue;
    }

    const { profile } = classifier.classifyHeuristic(
      facts,
      m.countryCode ?? 'IN',
      m.jurisdiction ?? undefined,
    );
    const graph = await graphExtractor.extract(facts);
    const taskGraph = taskGraphBuilder.build(profile, graph);
    const detail = `${m.id.slice(0, 8)}… ${profile.practiceArea}/${profile.subPracticeArea ?? '—'}`;

    if (dryRun) {
      if (processed === 1 || processed % progressEvery === 0 || processed === matters.length) {
        logProgress('dry-run matters', processed, matters.length, detail);
      } else if (process.argv.includes('--verbose')) {
        console.log(`[dry-run] matter ${m.id}: ${profile.practiceArea}/${profile.subPracticeArea ?? '—'}`);
      }
      updated += 1;
      continue;
    }

    await prisma.matter.update({
      where: { id: m.id },
      data: {
        matterProfile: profile as object,
        matterGraph: graph as object,
        matterTaskGraph: taskGraph as object,
      },
    });
    updated += 1;

    if (processed % progressEvery === 0 || processed === matters.length) {
      logProgress('matters', processed, matters.length, detail);
    }
  }

  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${updated} matters; skipped ${skipped} (empty facts).`,
  );
  return { processed, skipped, updated };
}

async function main() {
  const started = Date.now();
  if (dryRun) {
    console.log('Dry run — no database writes');
  }
  console.log(`Progress interval: every ${progressEvery} records`);

  const caseStats = await backfillConsumerCases();
  const matterStats = await backfillMatters();

  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsedSec}s — cases ${caseStats.updated}, matters ${matterStats.updated}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
