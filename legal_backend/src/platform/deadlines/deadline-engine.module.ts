import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { JobsModule } from '@/jobs/jobs.module';
import { DeadlineEngineController } from './deadline-engine.controller';
import { DeadlineEngineService } from './deadline-engine.service';

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [DeadlineEngineController],
  providers: [DeadlineEngineService],
  exports: [DeadlineEngineService],
})
export class DeadlineEngineModule {}
