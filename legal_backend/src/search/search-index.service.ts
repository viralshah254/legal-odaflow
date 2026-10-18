import { Injectable } from '@nestjs/common';
import { JobsService } from '@/jobs/jobs.service';

export type SearchIndexEntityType = 'matter' | 'client' | 'document' | 'task';

@Injectable()
export class SearchIndexService {
  constructor(private readonly jobsService: JobsService) {}

  indexEntity(
    tenantId: string,
    entityType: SearchIndexEntityType,
    entityId: string,
  ): void {
    void this.jobsService.enqueueSearchIndex({
      tenantId,
      entityType,
      entityId,
      action: 'upsert',
    });
  }

  deleteEntity(
    tenantId: string,
    entityType: SearchIndexEntityType,
    entityId: string,
  ): void {
    void this.jobsService.enqueueSearchIndex({
      tenantId,
      entityType,
      entityId,
      action: 'delete',
    });
  }
}
