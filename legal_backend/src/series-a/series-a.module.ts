import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { AuditModule } from '@/audit/audit.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TimeModule } from '@/time/time.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { EthicalWallsController } from './ethical-walls.controller';
import { EthicalWallsService } from './ethical-walls.service';
import { BulkReviewController } from './bulk-review.controller';
import { BulkReviewService } from './bulk-review.service';
import { SuggestedTimeController } from './suggested-time.controller';
import { SuggestedTimeService } from './suggested-time.service';

@Module({
  imports: [forwardRef(() => AiModule), AuditModule, NotificationsModule, TimeModule],
  controllers: [
    EvidenceController,
    InboxController,
    EthicalWallsController,
    BulkReviewController,
    SuggestedTimeController,
  ],
  providers: [
    EvidenceService,
    InboxService,
    EthicalWallsService,
    BulkReviewService,
    SuggestedTimeService,
  ],
  exports: [EvidenceService, InboxService, BulkReviewService, SuggestedTimeService],
})
export class SeriesAModule {}
