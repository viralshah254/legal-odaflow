/**
 * Run tier-1 statute corpus sync (IN/US/KE/GB) + US CourtListener case-law pull.
 *
 * Run:
 *   npm run sync:legal-corpus
 *   npm run sync:legal-corpus -- IN --all-acts
 */
import './cli-bootstrap';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { LegalSourceService } from '../src/legal-sources/legal-source.service';
import { CourtListenerConnector } from '../src/legal-sources/connectors/courtlistener.connector';
import { IndiaKanoonConnector } from '../src/legal-sources/connectors/india-kanoon.connector';
import { EmbeddingService } from '../src/embeddings/embedding.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFAULT_COUNTRIES = ['IN', 'US', 'KE', 'GB'] as const;

const US_CASE_LAW_QUERIES = [
  'employment discrimination Title VII',
  'contract breach damages',
  'fourth amendment search seizure',
  'personal jurisdiction minimum contacts',
  'securities fraud Rule 10b-5',
];

const IN_CASE_LAW_QUERIES = [
  'Kesavananda Bharati basic structure doctrine',
  'Maneka Gandhi Article 21 due process',
  'Vishaka sexual harassment workplace guidelines',
  'Shreya Singhal Section 66A IT Act',
  'contract breach Indian Contract Act damages',
  'Rajnesh v Neha maintenance Section 125 alimony',
  'Bhuwan Mohan Singh v Meena maintenance interim',
  'Chaturbhuj v Sita Bai maintenance wife capacity',
  'Shail Kumari Devi maintenance husband financial capacity',
  'Anju Garg v Deepak Kumar Garg maintenance',
  'criminal revision maintenance interim order BNSS',
  'Section 125 CrPC maintenance quantum Gujarat High Court',
];

async function syncUsCaseLaw(
  courtListener: CourtListenerConnector,
  embeddingService: EmbeddingService,
  prisma: PrismaService,
) {
  if (!courtListener.isConfigured()) {
    console.log('CourtListener not configured — skipping US case-law sync');
    return { authorityCount: 0, chunkCount: 0 };
  }

  let authorityCount = 0;
  let chunkCount = 0;
  const seen = new Set<string>();

  for (const query of US_CASE_LAW_QUERIES) {
    const results = await courtListener.search({ query, limit: 5 });
    for (const result of results) {
      if (seen.has(result.id)) continue;
      seen.add(result.id);

      const authority = await prisma.legalAuthority.upsert({
        where: { id: result.id },
        create: {
          id: result.id,
          countryCode: 'US',
          title: result.title,
          citation: result.citation,
          sourceName: 'CourtListener',
          sourceUrl: result.sourceUrl,
          summary: result.summary,
          jurisdiction: result.court,
          authorityType: 'CASE_LAW',
          embeddingStatus: 'PENDING',
          topics: [],
          practiceAreas: [],
        },
        update: {
          title: result.title,
          citation: result.citation,
          summary: result.summary,
          sourceUrl: result.sourceUrl,
          jurisdiction: result.court,
        },
      });
      authorityCount += 1;

      const text = [result.title, result.summary ?? '', result.citation ?? '']
        .filter(Boolean)
        .join('\n');
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += 1200) {
        chunks.push(text.slice(i, i + 1200));
      }

      const stored = await embeddingService.storeChunks(
        chunks.map((content, chunkIndex) => ({
          sourceType: 'LEGAL_AUTHORITY' as const,
          sourceId: authority.id,
          chunkIndex,
          content,
          countryCode: 'US',
          jurisdiction: result.court ?? undefined,
          modelName: embeddingService.getEmbeddingModel(),
        })),
      );
      chunkCount += stored.stored;

      await prisma.legalAuthority.update({
        where: { id: authority.id },
        data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
      });
    }
  }

  return { authorityCount, chunkCount };
}

async function syncInCaseLaw(
  indiaKanoon: IndiaKanoonConnector,
  embeddingService: EmbeddingService,
  prisma: PrismaService,
) {
  if (!indiaKanoon.isConfigured()) {
    console.log('India Kanoon not configured — skipping IN case-law sync');
    return { authorityCount: 0, chunkCount: 0 };
  }

  let authorityCount = 0;
  let chunkCount = 0;
  const seen = new Set<string>();

  for (const query of IN_CASE_LAW_QUERIES) {
    const results = await indiaKanoon.search({ query, limit: 5 });
    for (const result of results) {
      if (seen.has(result.id)) continue;
      seen.add(result.id);

      const authority = await prisma.legalAuthority.upsert({
        where: { id: result.id },
        create: {
          id: result.id,
          countryCode: 'IN',
          title: result.title,
          citation: result.citation,
          sourceName: 'Indian Kanoon',
          sourceUrl: result.sourceUrl,
          summary: result.summary,
          jurisdiction: result.court ?? 'India',
          authorityType: 'CASE_LAW',
          embeddingStatus: 'PENDING',
          topics: [],
          practiceAreas: [],
        },
        update: {
          title: result.title,
          citation: result.citation,
          summary: result.summary,
          sourceUrl: result.sourceUrl,
          jurisdiction: result.court ?? 'India',
        },
      });
      authorityCount += 1;

      const text = [result.title, result.summary ?? '', result.citation ?? '']
        .filter(Boolean)
        .join('\n');
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += 1200) {
        chunks.push(text.slice(i, i + 1200));
      }

      const stored = await embeddingService.storeChunks(
        chunks.map((content, chunkIndex) => ({
          sourceType: 'LEGAL_AUTHORITY' as const,
          sourceId: authority.id,
          chunkIndex,
          content,
          countryCode: 'IN',
          jurisdiction: result.court ?? undefined,
          modelName: embeddingService.getEmbeddingModel(),
        })),
      );
      chunkCount += stored.stored;

      await prisma.legalAuthority.update({
        where: { id: authority.id },
        data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
      });
    }
  }

  return { authorityCount, chunkCount };
}

async function main() {
  const allActs = process.argv.includes('--all-acts');
  const countries = (
    process.argv.slice(2).filter((a) => !a.startsWith('--')).length
      ? process.argv.slice(2).filter((a) => !a.startsWith('--'))
      : [...DEFAULT_COUNTRIES]
  ).map((c) => c.toUpperCase());

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const courtListener = app.get(CourtListenerConnector);
    const indiaKanoon = app.get(IndiaKanoonConnector);
    const embeddingService = app.get(EmbeddingService);
    const prisma = app.get(PrismaService);

    for (const code of countries) {
      console.log(`\n=== Tier-1 statute sync: ${code} ===`);
      const results = await ingest.syncTier1Statutes(code);
      for (const row of results) {
        console.log(
          JSON.stringify({
            countryCode: row.countryCode,
            actId: row.actId,
            sectionsUpserted: row.sectionsUpserted,
            chunksStored: row.chunksStored,
            connectorHits: row.connectorHits,
            errors: row.errors,
          }),
        );
      }
    }

    if (countries.includes('IN') && allActs) {
      console.log('\n=== Full India manifest act ingest ===');
      const allResults = await ingest.ingestAllManifestActs('IN');
      console.log(
        JSON.stringify({
          actsProcessed: allResults.length,
          sectionsUpserted: allResults.reduce((sum, r) => sum + r.sectionsUpserted, 0),
          errors: allResults.flatMap((r) => r.errors).length,
        }),
      );
    }

    if (countries.includes('KE') && allActs) {
      console.log('\n=== Full Kenya manifest act ingest (Laws.Africa) ===');
      const keResults = await ingest.ingestAllManifestActs('KE');
      console.log(
        JSON.stringify({
          actsProcessed: keResults.length,
          sectionsUpserted: keResults.reduce((sum, r) => sum + r.sectionsUpserted, 0),
          errors: keResults.flatMap((r) => r.errors).length,
        }),
      );
    }

    if (countries.includes('US') && allActs) {
      console.log('\n=== Full US federal USC + CFR bulk ingest ===');
      const federalResults = await ingest.ingestAllUsFederal();
      console.log(
        JSON.stringify({
          actsProcessed: federalResults.length,
          sectionsUpserted: federalResults.reduce((sum, r) => sum + r.sectionsUpserted, 0),
          errors: federalResults.flatMap((r) => r.errors).length,
        }),
      );

      console.log('\n=== Full US state manifest ingest ===');
      const stateResults = await ingest.ingestAllUsStateManifestActs();
      console.log(
        JSON.stringify({
          actsProcessed: stateResults.length,
          sectionsUpserted: stateResults.reduce((sum, r) => sum + r.sectionsUpserted, 0),
          errors: stateResults.flatMap((r) => r.errors).length,
        }),
      );
    }

    if (countries.includes('US')) {
      console.log('\n=== US CourtListener case-law sync ===');
      const cl = await syncUsCaseLaw(courtListener, embeddingService, prisma);
      console.log(JSON.stringify(cl));
    }

    if (countries.includes('IN')) {
      console.log('\n=== IN India Kanoon case-law sync ===');
      const ik = await syncInCaseLaw(indiaKanoon, embeddingService, prisma);
      console.log(JSON.stringify(ik));
    }

    if (countries.includes('KE')) {
      console.log('\n=== KE Kenya Law case-law sync ===');
      const legalSources = app.get(LegalSourceService);
      const keCaseLaw = await legalSources.syncKenyaCaseLaw({ feedLimit: 100 });
      console.log(JSON.stringify(keCaseLaw));
    }

    const status = await ingest.getIngestStatus();
    console.log('\n=== Statute section counts by country ===');
    console.log(JSON.stringify(status, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
