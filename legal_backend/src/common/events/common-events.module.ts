import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { DomainEventBus } from './domain-event-bus';
import { OutboxService } from './outbox.service';
import { OutboxPublisherScheduler } from './outbox-publisher.scheduler';

/**
 * CommonEventsModule
 *
 * Provides DomainEventBus, OutboxService, and the OutboxPublisherScheduler.
 * Import this module in any feature module that needs to publish domain events.
 * It is NOT global so that consumers declare the dependency explicitly.
 *
 * To use, add `CommonEventsModule` to the imports array of your feature module.
 * Then inject `OutboxService` and/or `DomainEventBus` via constructor injection.
 */
@Module({
  imports: [PrismaModule],
  providers: [DomainEventBus, OutboxService, OutboxPublisherScheduler],
  exports: [DomainEventBus, OutboxService],
})
export class CommonEventsModule {}
