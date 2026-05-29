import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '@/ai/ai.module';
import { AutomationsModule } from '@/automations/automations.module';
import { CacheModule } from '@/cache/cache.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { OcrModule } from '@/ocr/ocr.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MatterOutcomeModule } from '@/matter-outcome/matter-outcome.module';
import { JobsModule } from '../jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    CacheModule,
    RealtimeModule,
    EmbeddingsModule,
    LegalSourcesModule,
    JobsModule,
    AiModule,
    OcrModule,
    NotificationsModule,
    AutomationsModule,
    MatterOutcomeModule,
  ],
})
export class WorkerAppModule {}
