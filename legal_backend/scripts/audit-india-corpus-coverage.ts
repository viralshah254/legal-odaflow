/**
 * Audit India corpus coverage: DB section counts vs StatuteActCache per manifest act.
 *
 * Run:
 *   npm run audit:india-corpus
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadIndiaSourcesManifest } from '../src/legal-sources/india-manifest.loader';
import { resolveIngestActId } from '../src/legal-search/statute-registry';

const TIER1_ACTS = [
  'bns',
  'bnss',
  'bsa',
  'ipc',
  'crpc',
  'iea',
  'pocso-act-2012',
  'ndps-act-1985',
  'pmla',
  'cpc',
  'negotiable-instruments',
];

interface ActCoverageRow {
  manifestActId: string;
  registryActId: string;
  tier1: boolean;
  dbSectionCount: number;
  cacheSectionCount: number | null;
  coveragePct: number | null;
  gap: number | null;
  status: 'ok' | 'gap' | 'missing-cache' | 'empty';
}

interface AuditReport {
  ok: boolean;
  tier1CoveragePct: number;
  tier1ThresholdPct: number;
  acts: ActCoverageRow[];
  gaps: ActCoverageRow[];
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const manifest = loadIndiaSourcesManifest();
    const rows: ActCoverageRow[] = [];

    for (const entry of manifest.acts) {
      const manifestActId = entry.actId;
      const registryActId = resolveIngestActId(manifestActId, 'IN') ?? manifestActId;
      const tier1 = TIER1_ACTS.includes(manifestActId);

      const dbSectionCount = await prisma.legalAuthority.count({
        where: {
          countryCode: 'IN',
          id: { startsWith: `statute-in-${registryActId}-` },
        },
      });

      const cache = await prisma.statuteActCache.findUnique({
        where: { id: registryActId },
      });
      const cacheSectionCount = cache?.sectionCount ?? null;

      let coveragePct: number | null = null;
      let gap: number | null = null;
      let status: ActCoverageRow['status'] = 'empty';

      if (cacheSectionCount && cacheSectionCount > 0) {
        coveragePct = Math.round((dbSectionCount / cacheSectionCount) * 1000) / 10;
        gap = cacheSectionCount - dbSectionCount;
        status = coveragePct >= 90 ? 'ok' : 'gap';
      } else if (dbSectionCount > 0) {
        coveragePct = 100;
        status = 'missing-cache';
      }

      rows.push({
        manifestActId,
        registryActId,
        tier1,
        dbSectionCount,
        cacheSectionCount,
        coveragePct,
        gap,
        status,
      });
    }

    const tier1Rows = rows.filter((row) => row.tier1);
    const tier1Ok = tier1Rows.filter(
      (row) => row.status === 'ok' || (row.coveragePct !== null && row.coveragePct >= 90),
    );
    const tier1CoveragePct =
      tier1Rows.length === 0
        ? 0
        : Math.round((tier1Ok.length / tier1Rows.length) * 1000) / 10;

    const report: AuditReport = {
      ok: tier1CoveragePct >= 90,
      tier1CoveragePct,
      tier1ThresholdPct: 90,
      acts: rows,
      gaps: rows.filter((row) => row.status === 'gap' || row.status === 'empty'),
    };

    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
      console.error(
        `\nAudit FAILED — tier-1 coverage ${tier1CoveragePct}% is below ${report.tier1ThresholdPct}%`,
      );
      process.exit(1);
    }

    console.log(`\nAudit PASSED — tier-1 coverage ${tier1CoveragePct}%.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
