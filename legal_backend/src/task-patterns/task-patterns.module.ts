import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { TaskPatternsController } from './task-patterns.controller';
import { TaskPatternsService } from './task-patterns.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TaskPatternsController],
  providers: [TaskPatternsService],
  exports: [TaskPatternsService],
})
export class TaskPatternsModule {}
