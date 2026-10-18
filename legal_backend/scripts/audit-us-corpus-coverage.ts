/**
 * Audit US corpus coverage: DB section counts per USC/CFR title and state manifest act.
 *
 * Run:
 *   npm run audit:us-corpus
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadAllUsStateManifests } from '../src/legal-sources/us-manifest.loader';
import { findStatuteById } from '../src/legal-search/statute-registry';
import {
  CFR_TITLE_NUMBERS,
  USC_TITLE_NUMBERS,
} from '../src/legal-search/statute-registry/us.statutes.federal-bulk';

interface ActCoverageRow {
  actId: string;
  category: 'usc' | 'cfr' | 'state';
  dbSectionCount: number;
  connectorHits: number | null;
  status: 'ok' | 'empty' | 'low';
}

interface AuditReport {
  ok: boolean;
  uscTitlesWithSections: number;
  cfrTitlesWithSections: number;
  stateActsWithSections: number;
  acts: ActCoverageRow[];
  gaps: ActCoverageRow[];
}

const MIN_SECTIONS_USC = 10;
const MIN_SECTIONS_CFR = 5;
const MIN_SECTIONS_STATE = 3;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const rows: ActCoverageRow[] = [];

    for (const titleNum of USC_TITLE_NUMBERS) {
      const actId = `usc-title-${titleNum}`;
      const dbSectionCount = await prisma.legalAuthority.count({
        where: {
          countryCode: 'US',
          id: { startsWith: `statute-us-${actId}-` },
        },
      });
      const cache = await prisma.statuteActCache.findUnique({ where: { id: actId } });
      rows.push({
        actId,
        category: 'usc',
        dbSectionCount,
        connectorHits: cache?.sectionCount ?? null,
        status:
          dbSectionCount >= MIN_SECTIONS_USC
            ? 'ok'
            : dbSectionCount > 0
              ? 'low'
              : 'empty',
      });
    }

    for (const titleNum of CFR_TITLE_NUMBERS) {
      const actId = `cfr-title-${titleNum}`;
      const dbSectionCount = await prisma.legalAuthority.count({
        where: {
          countryCode: 'US',
          id: { startsWith: `statute-us-${actId}-` },
        },
      });
      const cache = await prisma.statuteActCache.findUnique({ where: { id: actId } });
      rows.push({
        actId,
        category: 'cfr',
        dbSectionCount,
        connectorHits: cache?.sectionCount ?? null,
        status:
          dbSectionCount >= MIN_SECTIONS_CFR
            ? 'ok'
            : dbSectionCount > 0
              ? 'low'
              : 'empty',
      });
    }

    const stateManifests = loadAllUsStateManifests();
    for (const manifest of stateManifests) {
      for (const entry of manifest.acts) {
        const actId = findStatuteById(entry.actId)?.id ?? entry.actId;
        const dbSectionCount = await prisma.legalAuthority.count({
          where: {
            countryCode: 'US',
            id: { startsWith: `statute-us-${actId}-` },
          },
        });
        rows.push({
          actId,
          category: 'state',
          dbSectionCount,
          connectorHits: null,
          status:
            dbSectionCount >= MIN_SECTIONS_STATE
              ? 'ok'
              : dbSectionCount > 0
                ? 'low'
                : 'empty',
        });
      }
    }

    const uscOk = rows.filter((r) => r.category === 'usc' && r.status === 'ok').length;
    const cfrOk = rows.filter((r) => r.category === 'cfr' && r.status === 'ok').length;
    const stateOk = rows.filter((r) => r.category === 'state' && r.status === 'ok').length;

    const report: AuditReport = {
      ok: uscOk >= USC_TITLE_NUMBERS.length * 0.5 && cfrOk >= CFR_TITLE_NUMBERS.length * 0.5,
      uscTitlesWithSections: uscOk,
      cfrTitlesWithSections: cfrOk,
      stateActsWithSections: stateOk,
      acts: rows,
      gaps: rows.filter((r) => r.status === 'empty' || r.status === 'low'),
    };

    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
      console.error(
        `\nAudit note — USC ok: ${uscOk}/${USC_TITLE_NUMBERS.length}, CFR ok: ${cfrOk}/${CFR_TITLE_NUMBERS.length}, state ok: ${stateOk}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\nAudit PASSED — USC ${uscOk}, CFR ${cfrOk}, state ${stateOk} acts meet thresholds.`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
