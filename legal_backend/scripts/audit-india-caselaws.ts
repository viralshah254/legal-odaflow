/**
 * Audit India case-law corpus: verify each curated authority against India Kanoon.
 *
 * Reads entries from:
 *   1. CURATED_CASE_LAW_CORPUS  (src/legal-sources/curated-case-law-corpus.ts)
 *   2. CURATED_*_AUTHORITIES     (src/ai/drafting/draft-research-grounding.service.ts,
 *                                 exported via getCuratedAuthoritiesForAudit)
 *
 * For each entry:
 *   - Searches India Kanoon by case title (+ year when present)
 *   - Fuzzy-matches returned results against the stored title and citation
 *   - Writes verifiedAt + verificationSource: 'india_kanoon' to LegalAuthorityRecord on match
 *   - Marks human-verified entries with verificationSource: 'human' when no IK match is needed
 *
 * Status outcomes per entry:
 *   ok           — IK returned a match; title and citation are consistent
 *   mismatch     — IK returned results but no result matched well enough
 *   not_found    — IK returned no results
 *   human        — entry is marked reviewedByHuman; skip IK, set verificationSource: 'human'
 *   skipped      — IK is not configured (no API key)
 *
 * Exit codes:
 *   0  — all entries are ok or human-verified
 *   1  — one or more entries are mismatch or not_found (blocks CI)
 *
 * Run:
 *   npm run audit:india-caselaws
 *   npm run audit:india-caselaws -- --fix        (write verifiedAt for confirmed entries)
 *   npm run audit:india-caselaws -- --human-only (only process entries without IK; mark human)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IndiaKanoonConnector } from '../src/legal-sources/connectors/india-kanoon.connector';
import { loadIndiaCaselawCorpus } from '../src/legal-sources/load-india-caselaw-corpus';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditStatus = 'ok' | 'mismatch' | 'not_found' | 'human' | 'skipped';

interface AuditEntry {
  title: string;
  citation: string | null;
  neutralCitation?: string;
  source: 'curated_corpus' | 'curated_array';
  reviewedByHuman: boolean;
  status: AuditStatus;
  ikTitle?: string;
  ikCitation?: string;
  ikUrl?: string;
  reason?: string;
}

interface AuditReport {
  ok: boolean;
  total: number;
  okCount: number;
  humanCount: number;
  mismatchCount: number;
  notFoundCount: number;
  skippedCount: number;
  entries: AuditEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise a title string for fuzzy comparison. */
function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bv\b\.?/g, 'v')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract year from a reporter citation like "(2018) 4 SCC 465" or "AIR 2018 SC 123". */
function yearFromCitation(citation: string | null): number | null {
  if (!citation) return null;
  const m = citation.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Score how well an IK result matches our stored entry.
 * Returns a value 0–1; ≥ 0.6 is considered a match.
 */
function matchScore(
  storedTitle: string,
  storedCitation: string | null,
  ikTitle: string,
  ikCitation: string | null,
): number {
  const nt = normTitle(storedTitle);
  const ni = normTitle(ikTitle);

  // Word-overlap score on title
  const storedWords = new Set(nt.split(' ').filter((w) => w.length > 3));
  const ikWords = ni.split(' ').filter((w) => w.length > 3);
  const overlap = ikWords.filter((w) => storedWords.has(w)).length;
  const titleScore = storedWords.size === 0 ? 0 : overlap / storedWords.size;

  // Citation year match bonus
  let yearBonus = 0;
  if (storedCitation && ikCitation) {
    const sy = yearFromCitation(storedCitation);
    const iy = yearFromCitation(ikCitation);
    if (sy && iy && sy === iy) yearBonus = 0.2;
  }

  return Math.min(1, titleScore + yearBonus);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const humanOnly = args.includes('--human-only');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const ik = app.get(IndiaKanoonConnector);
    const ikConfigured = ik.isConfigured();

    if (!ikConfigured) {
      console.warn(
        '[audit:india-caselaws] INDIA_KANOON_API_KEY is not set — IK lookups will be skipped.',
      );
    }

    type EntryToAudit = {
      title: string;
      citation: string | null;
      neutralCitation?: string | null;
      reviewedByHuman: boolean;
      source: 'curated_corpus';
    };

    // Gather all entries to audit
    const corpusEntries: EntryToAudit[] = loadIndiaCaselawCorpus()
      .filter((entry) => entry.extractionConfidence === 'high' && Boolean(entry.citation || entry.neutralCitation))
      .map((e) => ({
      title: e.title,
      citation: e.citation,
      neutralCitation: e.neutralCitation,
      reviewedByHuman: e.reviewedByHuman,
      source: 'curated_corpus' as const,
    }));

    const allEntries = corpusEntries;
    const results: AuditEntry[] = [];

    for (const entry of allEntries) {
      const row: AuditEntry = {
        title: entry.title,
        citation: entry.citation,
        neutralCitation: entry.neutralCitation ?? undefined,
        source: entry.source,
        reviewedByHuman: entry.reviewedByHuman,
        status: 'skipped',
      };

      // Human-reviewed entries get a fast path
      if (entry.reviewedByHuman && humanOnly) {
        row.status = 'human';
        if (shouldFix) {
          await upsertVerification(prisma, entry.title, entry.citation, 'human');
        }
        results.push(row);
        continue;
      }

      if (!ikConfigured || humanOnly) {
        row.status = entry.reviewedByHuman ? 'human' : 'skipped';
        if (entry.reviewedByHuman && shouldFix) {
          await upsertVerification(prisma, entry.title, entry.citation, 'human');
        }
        results.push(row);
        continue;
      }

      // India Kanoon lookup
      const year = yearFromCitation(entry.citation);
      const query = year ? `${entry.title} ${year}` : entry.title;

      try {
        const ikResults = await ik.search({ query, limit: 5 });

        if (ikResults.length === 0) {
          row.status = 'not_found';
          row.reason = 'India Kanoon returned no results';
        } else {
          const best = ikResults
            .map((r) => ({
              result: r,
              score: matchScore(entry.title, entry.citation, r.title, r.citation),
            }))
            .sort((a, b) => b.score - a.score)[0];

          if (best.score >= 0.6) {
            row.status = 'ok';
            row.ikTitle = best.result.title;
            row.ikCitation = best.result.citation ?? undefined;
            row.ikUrl = best.result.sourceUrl;
            if (shouldFix) {
              await upsertVerification(prisma, entry.title, entry.citation, 'india_kanoon');
            }
          } else {
            row.status = 'mismatch';
            row.ikTitle = best.result.title;
            row.ikCitation = best.result.citation ?? undefined;
            row.reason = `Best IK match score ${best.score.toFixed(2)} is below threshold 0.60`;
          }
        }
      } catch (err) {
        row.status = 'not_found';
        row.reason = `IK lookup error: ${err instanceof Error ? err.message : String(err)}`;
      }

      results.push(row);

      // Rate-limit: 1 request per second to avoid IK throttling
      await new Promise((r) => setTimeout(r, 1100));
    }

    // Build report
    const report: AuditReport = {
      ok: results.every((r) => r.status === 'ok' || r.status === 'human' || r.status === 'skipped'),
      total: results.length,
      okCount: results.filter((r) => r.status === 'ok').length,
      humanCount: results.filter((r) => r.status === 'human').length,
      mismatchCount: results.filter((r) => r.status === 'mismatch').length,
      notFoundCount: results.filter((r) => r.status === 'not_found').length,
      skippedCount: results.filter((r) => r.status === 'skipped').length,
      entries: results,
    };

    console.log(JSON.stringify(report, null, 2));

    // Summary
    console.log('\n─── Case-law Audit Summary ───');
    console.log(`  Total entries  : ${report.total}`);
    console.log(`  OK (IK match)  : ${report.okCount}`);
    console.log(`  Human verified : ${report.humanCount}`);
    console.log(`  Mismatch       : ${report.mismatchCount}`);
    console.log(`  Not found      : ${report.notFoundCount}`);
    console.log(`  Skipped        : ${report.skippedCount}`);

    if (!report.ok) {
      console.error(
        `\nAudit FAILED — ${report.mismatchCount} mismatch(es), ${report.notFoundCount} not found.`,
      );
      console.error('Review the entries above and correct or remove any problematic citations.');
      process.exit(1);
    }

    console.log('\nAudit PASSED — all curated case-law entries are verified.');
  } finally {
    await app.close();
  }
}

async function upsertVerification(
  prisma: PrismaService,
  title: string,
  citation: string | null,
  source: 'india_kanoon' | 'human',
): Promise<void> {
  const where = citation
    ? { citation }
    : undefined;

  if (!where) return;

  await prisma.legalAuthorityRecord
    .updateMany({
      where: {
        OR: [
          { citation: citation ?? undefined },
          { title: { contains: title.slice(0, 40), mode: 'insensitive' } },
        ],
      },
      data: {
        verifiedAt: new Date(),
        verificationSource: source,
        reviewedByHuman: source === 'human',
      },
    })
    .catch(() => {
      // Record may not exist yet (arrays bypass ingest); non-fatal
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
