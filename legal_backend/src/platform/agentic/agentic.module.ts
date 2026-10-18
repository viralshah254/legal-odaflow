import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { JobsModule } from '@/jobs/jobs.module'
import { AgenticWorkflowService } from './agentic-workflow.service'
import { AgenticWorkflowController } from './agentic-workflow.controller'

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [AgenticWorkflowController],
  providers: [AgenticWorkflowService],
  exports: [AgenticWorkflowService],
})
export class AgenticModule {}
