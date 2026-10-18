/**
 * Evidence-first audit of Kenya primary Acts/Constitution coverage.
 *
 * Joins the KE manifest to DB section counts, probes missing acts against live
 * Kenya Law HTML (and Laws.Africa XML when LAWS_AFRICA_API_TOKEN is set), and
 * writes corpus/ke/primary-coverage-report.json.
 *
 * Run:
 *   npm run audit:ke-primary
 *   npm run audit:ke-primary -- --skip-probe          # DB buckets only
 *   npm run audit:ke-primary -- --delay-ms=1500
 *   npm run audit:ke-primary -- --only-missing        # probe only sectionCount=0
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { LawsAfricaConnector } from '../src/legal-sources/connectors/laws-africa.connector';
import {
  kenyaLawSourcePdfUrl,
  parseKenyaLawAknHtmlSections,
} from '../src/legal-sources/connectors/kenya-law.connector';
import {
  configureKenyaLawRateLimit,
  kenyaLawFetchHeaders,
  kenyaLawRateLimit,
  isKenyaLawRetryableStatus,
  kenyaLawThrottleBackoff,
} from '../src/legal-sources/connectors/kenya-law-rate-limit';
import { loadKeSourcesManifest } from '../src/legal-sources/ke-manifest.loader';
import { getStatutesForCountry } from '../src/legal-search/statute-registry';

const REPORT_PATH = resolve(process.cwd(), 'corpus/ke/primary-coverage-report.json');
const UNRECOVERABLE_PATH = resolve(process.cwd(), 'corpus/ke/primary-unrecoverable.json');
const PRIMARY_NATURES = new Set(['act', 'constitution']);
const PROBE_TIMEOUT_MS = 120_000;

type Bucket = 'indexed' | 'html_ready' | 'xml_ready' | 'pdf_ready' | 'unrecoverable';

interface ProbeEvidence {
  httpStatus: number | null;
  htmlBytes: number;
  aknSectionCount: number;
  parserSectionCount: number;
  lawsAfricaEnabled: boolean;
  lawsAfricaXmlSections: number | null;
  lawsAfricaError: string | null;
  sourcePdfUrl: string | null;
  sourcePdfOk: boolean | null;
  sourcePdfBytes: number | null;
  sourcePdfError: string | null;
  error: string | null;
}

interface ActAuditRow {
  actId: string;
  title: string;
  nature: string;
  publicUrl: string;
  expressionFrbrUri: string;
  sectionCount: number;
  bucket: Bucket;
  probe: ProbeEvidence | null;
}

interface RegistryRow {
  actId: string;
  title: string;
  sectionCount: number;
  ok: boolean;
}

function parseArgs(argv: string[]) {
  const delayRaw = argv.find((arg) => arg.startsWith('--delay-ms='))?.split('=')[1];
  const delayMs = delayRaw ? parseInt(delayRaw, 10) : 800;
  return {
    skipProbe: argv.includes('--skip-probe'),
    onlyMissing: argv.includes('--only-missing') || !argv.includes('--probe-all'),
    delayMs: Number.isFinite(delayMs) ? delayMs : 800,
  };
}

function isPrimary(nature: string | undefined): boolean {
  return PRIMARY_NATURES.has(nature ?? 'act');
}

async function probeHtml(url: string): Promise<{
  httpStatus: number | null;
  htmlBytes: number;
  aknSectionCount: number;
  parserSectionCount: number;
  error: string | null;
}> {
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await kenyaLawRateLimit();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        headers: kenyaLawFetchHeaders(),
      });
      if (isKenyaLawRetryableStatus(res.status) && attempt < 3) {
        await kenyaLawThrottleBackoff(res.status, attempt);
        continue;
      }
      if (!res.ok) {
        return {
          httpStatus: res.status,
          htmlBytes: 0,
          aknSectionCount: 0,
          parserSectionCount: 0,
          error: `HTTP ${res.status}`,
        };
      }
      const body = await res.text();
      const aknSectionCount = (body.match(/class="akn-section"/gi) ?? []).length;
      const parserSectionCount = parseKenyaLawAknHtmlSections(body, url).length;
      return {
        httpStatus: res.status,
        htmlBytes: Buffer.byteLength(body, 'utf8'),
        aknSectionCount,
        parserSectionCount,
        error: null,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < 3) {
        await kenyaLawThrottleBackoff(503, attempt);
      }
    }
  }
  return {
    httpStatus: null,
    htmlBytes: 0,
    aknSectionCount: 0,
    parserSectionCount: 0,
    error: lastError,
  };
}

async function probeSourcePdf(publicUrl: string): Promise<{
  sourcePdfUrl: string;
  sourcePdfOk: boolean;
  sourcePdfBytes: number | null;
  sourcePdfError: string | null;
}> {
  const sourcePdfUrl = kenyaLawSourcePdfUrl(publicUrl);
  try {
    await kenyaLawRateLimit();
    const res = await fetch(sourcePdfUrl, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        ...kenyaLawFetchHeaders('application/pdf,*/*;q=0.9'),
      },
    });
    if (!res.ok) {
      return {
        sourcePdfUrl,
        sourcePdfOk: false,
        sourcePdfBytes: null,
        sourcePdfError: `HTTP ${res.status}`,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const isPdf =
      buf.subarray(0, 4).toString('utf8') === '%PDF' ||
      (res.headers.get('content-type') ?? '').includes('pdf');
    return {
      sourcePdfUrl,
      sourcePdfOk: isPdf && buf.length > 0,
      sourcePdfBytes: buf.length,
      sourcePdfError: isPdf ? null : 'Not a PDF body',
    };
  } catch (err) {
    return {
      sourcePdfUrl,
      sourcePdfOk: false,
      sourcePdfBytes: null,
      sourcePdfError: err instanceof Error ? err.message : String(err),
    };
  }
}

function classify(sectionCount: number, probe: ProbeEvidence | null): Bucket {
  if (sectionCount > 0) return 'indexed';
  if (!probe) return 'unrecoverable';
  if (probe.parserSectionCount > 0 || probe.aknSectionCount > 0) return 'html_ready';
  if ((probe.lawsAfricaXmlSections ?? 0) > 0) return 'xml_ready';
  if (probe.sourcePdfOk) return 'pdf_ready';
  return 'unrecoverable';
}

async function main() {
  const { skipProbe, onlyMissing, delayMs } = parseArgs(process.argv.slice(2));
  configureKenyaLawRateLimit(delayMs);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const prisma = app.get(PrismaService);
    const lawsAfrica = app.get(LawsAfricaConnector);
    const lawsAfricaEnabled = lawsAfrica.isEnabled();
    const status = await ingest.getIngestStatus('KE');
    const countByAct = new Map(status.acts.map((a) => [a.actId, a.sectionCount]));
    const manifest = loadKeSourcesManifest();
    const primaries = manifest.acts.filter((entry) => isPrimary(entry.nature));

    const rows: ActAuditRow[] = [];
    let probed = 0;

    for (const [index, entry] of primaries.entries()) {
      const sectionCount = countByAct.get(entry.actId) ?? 0;
      let probe: ProbeEvidence | null = null;

      const shouldProbe =
        !skipProbe && (!onlyMissing || sectionCount === 0);

      if (shouldProbe) {
        probed += 1;
        console.log(
          `[audit:ke-primary] Probing ${entry.actId} (${index + 1}/${primaries.length})…`,
        );
        const html = await probeHtml(entry.publicUrl);
        let lawsAfricaXmlSections: number | null = null;
        let lawsAfricaError: string | null = null;
        if (lawsAfricaEnabled && html.parserSectionCount === 0) {
          try {
            const doc = await lawsAfrica.fetchActDocument(entry.expressionFrbrUri);
            lawsAfricaXmlSections = doc?.sections.length ?? 0;
          } catch (err) {
            lawsAfricaError = err instanceof Error ? err.message : String(err);
            lawsAfricaXmlSections = 0;
          }
        }
        let sourcePdfUrl: string | null = null;
        let sourcePdfOk: boolean | null = null;
        let sourcePdfBytes: number | null = null;
        let sourcePdfError: string | null = null;
        if (html.parserSectionCount === 0 && html.aknSectionCount === 0) {
          const pdf = await probeSourcePdf(entry.publicUrl);
          sourcePdfUrl = pdf.sourcePdfUrl;
          sourcePdfOk = pdf.sourcePdfOk;
          sourcePdfBytes = pdf.sourcePdfBytes;
          sourcePdfError = pdf.sourcePdfError;
        }
        probe = {
          ...html,
          lawsAfricaEnabled,
          lawsAfricaXmlSections,
          lawsAfricaError,
          sourcePdfUrl,
          sourcePdfOk,
          sourcePdfBytes,
          sourcePdfError,
        };
      }

      const bucket = classify(sectionCount, probe);
      rows.push({
        actId: entry.actId,
        title: entry.title,
        nature: entry.nature ?? 'act',
        publicUrl: entry.publicUrl,
        expressionFrbrUri: entry.expressionFrbrUri,
        sectionCount,
        bucket,
        probe,
      });
    }

    const buckets = {
      indexed: rows.filter((r) => r.bucket === 'indexed').map((r) => r.actId),
      html_ready: rows.filter((r) => r.bucket === 'html_ready').map((r) => r.actId),
      xml_ready: rows.filter((r) => r.bucket === 'xml_ready').map((r) => r.actId),
      pdf_ready: rows.filter((r) => r.bucket === 'pdf_ready').map((r) => r.actId),
      unrecoverable: rows.filter((r) => r.bucket === 'unrecoverable').map((r) => r.actId),
    };

    // Registry actIds often differ from manifest ke-act-* IDs — count each directly.
    const registryActs = getStatutesForCountry('KE');
    const registry: RegistryRow[] = [];
    for (const statute of registryActs) {
      const sectionCount = await prisma.legalAuthority.count({
        where: {
          countryCode: 'KE',
          authorityType: 'STATUTE_SECTION',
          id: { startsWith: `statute-ke-${statute.id}-` },
        },
      });
      registry.push({
        actId: statute.id,
        title: statute.fullName,
        sectionCount,
        ok: sectionCount > 0,
      });
    }

    const primaryWithSections = buckets.indexed.length;
    const primaryMissing = primaries.length - primaryWithSections;
    const accounted =
      buckets.indexed.length +
      buckets.html_ready.length +
      buckets.xml_ready.length +
      buckets.pdf_ready.length +
      buckets.unrecoverable.length;

    const report = {
      builtAt: new Date().toISOString(),
      manifestSource: manifest.source,
      manifestBuiltAt: manifest.builtAt,
      lawsAfricaEnabled,
      primaryTotal: primaries.length,
      primaryWithSections,
      primaryMissing,
      accounted,
      buckets: {
        indexed: buckets.indexed.length,
        html_ready: buckets.html_ready.length,
        xml_ready: buckets.xml_ready.length,
        pdf_ready: buckets.pdf_ready.length,
        unrecoverable: buckets.unrecoverable.length,
      },
      recoveryActIds: [
        ...buckets.html_ready,
        ...buckets.xml_ready,
        ...buckets.pdf_ready,
      ],
      registry: {
        total: registry.length,
        ok: registry.filter((r) => r.ok).length,
        missing: registry.filter((r) => !r.ok).map((r) => r.actId),
        acts: registry,
      },
      acts: rows,
      note:
        'Definition of done: every primary is indexed (sectionCount>0) or listed under unrecoverable with probe evidence. ' +
        'SPA/empty-HTML shells with source.pdf are pdf_ready — recover via ingest:ke-manifest --from-unrecoverable.',
    };

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    const unrecoverableRows = rows.filter((r) => r.bucket === 'unrecoverable');
    writeFileSync(
      UNRECOVERABLE_PATH,
      JSON.stringify(
        {
          builtAt: report.builtAt,
          primaryTotal: report.primaryTotal,
          primaryWithSections,
          unrecoverableCount: unrecoverableRows.length,
          pdfReadyCount: buckets.pdf_ready.length,
          registryOk: `${report.registry.ok}/${report.registry.total}`,
          lawsAfricaEnabled,
          note:
            'Residual gaps after HTML + source.pdf probes. pdf_ready acts should be ingested with --from-unrecoverable before remaining here.',
          unrecoverable: unrecoverableRows.map((a) => ({
            actId: a.actId,
            title: a.title,
            publicUrl: a.publicUrl,
            httpStatus: a.probe?.httpStatus ?? null,
            htmlBytes: a.probe?.htmlBytes ?? null,
            aknSectionCount: a.probe?.aknSectionCount ?? null,
            sourcePdfOk: a.probe?.sourcePdfOk ?? null,
            sourcePdfBytes: a.probe?.sourcePdfBytes ?? null,
            sourcePdfError: a.probe?.sourcePdfError ?? null,
          })),
        },
        null,
        2,
      ),
    );

    console.log(
      JSON.stringify(
        {
          reportPath: REPORT_PATH,
          primaryTotal: report.primaryTotal,
          primaryWithSections,
          primaryMissing,
          accounted,
          buckets: report.buckets,
          recoveryActIds: report.recoveryActIds.length,
          registryOk: `${report.registry.ok}/${report.registry.total}`,
          registryMissing: report.registry.missing,
          probed,
          lawsAfricaEnabled,
        },
        null,
        2,
      ),
    );

    if (accounted !== primaries.length) {
      console.error(
        `[audit:ke-primary] Accounted ${accounted} !== primaryTotal ${primaries.length}`,
      );
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
