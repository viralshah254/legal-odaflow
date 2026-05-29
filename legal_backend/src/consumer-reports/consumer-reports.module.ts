import { Module } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import {
  ConsumerCasesReportsController,
  ConsumerReportsController,
} from './consumer-reports.controller';
import { ConsumerReportsService } from './consumer-reports.service';

@Module({
  imports: [AiModule],
  controllers: [ConsumerReportsController, ConsumerCasesReportsController],
  providers: [ConsumerReportsService],
  exports: [ConsumerReportsService],
})
export class ConsumerReportsModule {}
