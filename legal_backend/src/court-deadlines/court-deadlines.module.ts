import { Module } from '@nestjs/common';
import {
  CourtDeadlinesController,
  LimitationPeriodsController,
} from './court-deadlines.controller';
import { CourtDeadlinesService } from './court-deadlines.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CourtDeadlinesController, LimitationPeriodsController],
  providers: [CourtDeadlinesService],
  exports: [CourtDeadlinesService],
})
export class CourtDeadlinesModule {}
