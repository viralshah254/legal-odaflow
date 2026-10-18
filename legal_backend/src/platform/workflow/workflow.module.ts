import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { WorkflowPersistenceService } from './workflow-persistence.service';

@Module({
  imports: [PrismaModule],
  providers: [WorkflowPersistenceService],
  exports: [WorkflowPersistenceService],
})
export class WorkflowModule {}
