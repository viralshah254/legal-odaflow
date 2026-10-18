import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '@/jobs/jobs.service';

/**
 * MatterAutonomyService — fire-and-forget triggers that enqueue autonomous
 * matter intelligence jobs (similar cases, opponent analysis, strategy memos)
 * to the AI_LOW BullMQ queue.
 *
 * Triggers are called from lifecycle hooks in MattersService and
 * documents.service.ts without blocking the primary request.
 */
@Injectable()
export class MatterAutonomyService {
  private readonly logger = new Logger(MatterAutonomyService.name);

  constructor(private readonly jobs: JobsService) {}

  /** Called after a new matter is created. Queues a full init run. */
  triggerOnCreate(matterId: string, tenantId: string, userId: string): void {
    void this.jobs
      .enqueueMatterAutonomy({
        kind: 'matter_init',
        matterId,
        tenantId,
        userId,
        trigger: 'create',
      })
      .then(() => {
        this.logger.log(
          `[autonomy] Queued matter_init for matter=${matterId}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `[autonomy] Failed to queue matter_init for matter=${matterId}: ${String(err)}`,
        );
      });
  }

  /** Called after a document is uploaded to a matter. Queues a refresh run. */
  triggerOnDocumentUpload(
    matterId: string,
    tenantId: string,
    userId: string,
  ): void {
    void this.jobs
      .enqueueMatterAutonomy({
        kind: 'matter_refresh',
        matterId,
        tenantId,
        userId,
        trigger: 'document_upload',
      })
      .then(() => {
        this.logger.log(
          `[autonomy] Queued matter_refresh (doc upload) for matter=${matterId}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `[autonomy] Failed to queue matter_refresh for matter=${matterId}: ${String(err)}`,
        );
      });
  }

  /** Called when a matter status changes. Queues a strategy-focused refresh. */
  triggerOnStatusChange(
    matterId: string,
    tenantId: string,
    userId: string,
  ): void {
    void this.jobs
      .enqueueMatterAutonomy({
        kind: 'matter_refresh',
        matterId,
        tenantId,
        userId,
        trigger: 'status_change',
      })
      .then(() => {
        this.logger.log(
          `[autonomy] Queued matter_refresh (status change) for matter=${matterId}`,
        );
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `[autonomy] Failed to queue matter_refresh for matter=${matterId}: ${String(err)}`,
        );
      });
  }
}
