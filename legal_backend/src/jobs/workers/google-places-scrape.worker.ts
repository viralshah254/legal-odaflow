import { Worker, Job, UnrecoverableError } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { QUEUE_NAMES } from '../jobs.constants';
import { LawyerProspectsService } from '@/admin/lawyer-prospects.service';
import {
  GooglePlacesProspectService,
  GooglePlacesScrapeCancelledError,
} from '@/admin/google-places-prospect.service';

let appContext: INestApplicationContext | null = null;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
  ],
  providers: [LawyerProspectsService, GooglePlacesProspectService],
})
class GooglePlacesScrapeWorkerModule {}

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

/** Long-running scrape: extend lock each batch (200 firms ≈ 2–3 min). */
const LOCK_DURATION_MS = 10 * 60 * 1000;
const STALLED_INTERVAL_MS = 2 * 60 * 1000;
const MAX_STALLED_COUNT = 5;

export interface GooglePlacesScrapeJobPayload {
  runId: string;
  countryCode: string;
  state: string;
  city: string;
  mode?: 'scrape' | 'finalize-collected';
  scrapeMode?: 'full' | 'enrichment';
}

async function processGooglePlacesScrapeJob(job: Job<GooglePlacesScrapeJobPayload>) {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(GooglePlacesScrapeWorkerModule, {
      logger: ['error', 'warn', 'log'],
    });
  }

  const googlePlaces = appContext.get(GooglePlacesProspectService);
  const lawyerProspects = appContext.get(LawyerProspectsService);
  const jobContext = googlePlaces.jobContextFromBullJob(job);

  if (job.data.mode === 'finalize-collected') {
    try {
      const result = await googlePlaces.importCollectedPlaceIds(job.data.runId);
      const run = await lawyerProspects.getImportRun(job.data.runId);
      return await lawyerProspects.finalizeCancelledGooglePlacesImport(
        job.data.runId,
        result.placeCount > 0
          ? `Stopped by admin. Saved ${run.insertedCount} new and ${run.updatedCount} updated prospects from ${result.placeCount} discovered firms.`
          : 'Stopped by admin. No firms were discovered yet.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await lawyerProspects.finalizeCancelledGooglePlacesImport(
        job.data.runId,
        `Stopped by admin, but saving collected firms failed: ${message}`,
      );
      throw error;
    }
  }

  try {
    await googlePlaces.scrapeAndImport(
      job.data.countryCode,
      job.data.state,
      job.data.city,
      job.data.runId,
      jobContext,
      job.data.scrapeMode ?? 'full',
    );
    return {
      runId: job.data.runId,
      city: job.data.city,
      state: job.data.state,
      countryCode: job.data.countryCode,
      status: 'COMPLETED',
    };
  } catch (error) {
    if (error instanceof GooglePlacesScrapeCancelledError) {
      return { runId: job.data.runId, status: 'CANCELLED' };
    }

    const message = error instanceof Error ? error.message : String(error);
    const isStall =
      error instanceof UnrecoverableError ||
      message.includes('stalled') ||
      message.includes('Missing lock');

    const attempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade >= attempts - 1;

    if (isFinalAttempt && !isStall) {
      await lawyerProspects.markImportRunFailed(job.data.runId, message);
    } else if (isFinalAttempt && isStall) {
      await lawyerProspects.markImportRunFailed(
        job.data.runId,
        `${message}. Partial progress saved — start a new scrape to resume remaining batches.`,
      );
    }

    throw error;
  }
}

export function createGooglePlacesScrapeWorker() {
  return new Worker<GooglePlacesScrapeJobPayload>(
    QUEUE_NAMES.GOOGLE_PLACES_SCRAPE,
    processGooglePlacesScrapeJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      lockDuration: LOCK_DURATION_MS,
      stalledInterval: STALLED_INTERVAL_MS,
      maxStalledCount: MAX_STALLED_COUNT,
    },
  );
}
