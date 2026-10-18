import { Module } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { AiModule } from '@/ai/ai.module';
import { UsersModule } from '@/users/users.module';
import {
  ConsumerCasesReportsController,
  ConsumerReportsController,
} from './consumer-reports.controller';
import { ConsumerReportsService } from './consumer-reports.service';

@Module({
  imports: [AiModule, AiCreditsModule, UsersModule],
  controllers: [ConsumerReportsController, ConsumerCasesReportsController],
  providers: [ConsumerReportsService],
  exports: [ConsumerReportsService],
})
export class ConsumerReportsModule {}
