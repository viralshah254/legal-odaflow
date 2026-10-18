import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { QUEUE_NAMES } from '@/jobs/jobs.constants';

/**
 * Shape of the executionPlanJson.requestSnapshot stored by DraftJobService.
 * Must stay in sync with CreateDraftJobDto.
 */
interface RequestSnapshot {
  tenantId: string;
  userId: string;
  matterId: string | null;
  profile: string;
  documentKind: string;
  qualityTier: string;
  facts: string;
  jurisdiction?: string | null;
  courtName?: string | null;
  clientName?: string | null;
  opposingParty?: string | null;
  parties?: unknown;
  attachmentContext?: string | null;
  formNumber?: string | null;
  language?: string | null;
  pinnedSections?: unknown;
  pinnedCaseLaws?: unknown;
  knowledgeSources?: string[] | null;
  courtDraftRecordId?: string | null;
  workspaceV3Id?: string | null;
  confirmedCaseRecord?: unknown;
  accuracyMode?: string | null;
  bundleMode?: boolean | null;
  bundleIndex?: number | null;
}

interface ExecutionPlanJson {
  requestSnapshot?: RequestSnapshot;
  confirmedCaseRecord?: unknown;
  accuracyMode?: string | null;
  bundleMode?: boolean | null;
  bundleIndex?: number | null;
}

@Injectable()
export class DraftJobDispatchReconcilerService {
  private readonly logger = new Logger(DraftJobDispatchReconcilerService.name);
  private readonly draftQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.draftQueue = new Queue(QUEUE_NAMES.DRAFT_GENERATE, {
      connection: {
        url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        maxRetriesPerRequest: null,
      },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingDispatch(): Promise<void> {
    const pending = await this.prisma.draftJob.findMany({
      where: { dispatchStatus: 'pending_dispatch', status: 'queued' },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });
    for (const job of pending) {
      try {
        const plan = (job.executionPlanJson ?? {}) as ExecutionPlanJson;
        const snapshot = plan.requestSnapshot;

        if (!snapshot) {
          // Legacy job (pre-C06) — fall back to partial reconstruction.
          // These jobs lack facts/jurisdiction/etc.; log and skip rather than
          // re-dispatching with incomplete data which would produce wrong output.
          this.logger.warn(
            `Job ${job.id} has no requestSnapshot in executionPlanJson — cannot safely re-dispatch. Skipping.`,
          );
          continue;
        }

        // Build the complete BullMQ payload from the immutable request snapshot.
        const payload = {
          jobId: job.id,
          // Scalar fields stored at top level on the DraftJob row
          tenantId: job.tenantId,
          userId: job.userId,
          matterId: job.matterId,
          profile: job.profile,
          documentKind: job.documentKind,
          qualityTier: job.qualityTier,
          idempotencyKey: job.idempotencyKey,
          courtDraftRecordId: job.courtDraftRecordId,
          workspaceV3Id: job.workspaceV3Id,
          // Full semantic inputs from the immutable snapshot (B08 fix)
          facts: snapshot.facts,
          jurisdiction: snapshot.jurisdiction,
          courtName: snapshot.courtName,
          clientName: snapshot.clientName,
          opposingParty: snapshot.opposingParty,
          parties: snapshot.parties,
          attachmentContext: snapshot.attachmentContext,
          formNumber: snapshot.formNumber,
          language: snapshot.language,
          pinnedSections: snapshot.pinnedSections,
          pinnedCaseLaws: snapshot.pinnedCaseLaws,
          knowledgeSources: snapshot.knowledgeSources,
          confirmedCaseRecord: snapshot.confirmedCaseRecord,
          accuracyMode: snapshot.accuracyMode,
          bundleMode: snapshot.bundleMode,
          bundleIndex: snapshot.bundleIndex,
        };

        await this.draftQueue.add('DRAFT_GENERATE', payload, {
          jobId: job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
        await this.prisma.draftJob.update({
          where: { id: job.id },
          data: { dispatchStatus: 'dispatched', failureReason: null },
        });
        this.logger.log(`Re-dispatched draft job ${job.id} with full request snapshot`);
      } catch (err) {
        this.logger.warn(`Failed to re-dispatch job ${job.id}: ${String(err)}`);
      }
    }
  }
}
