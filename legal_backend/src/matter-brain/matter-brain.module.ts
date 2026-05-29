import { Module } from '@nestjs/common';
import { AccessModule } from '@/access/access.module';
import { MatterBrainController } from './matter-brain.controller';
import { MatterBrainService } from './matter-brain.service';

@Module({
  imports: [AccessModule],
  controllers: [MatterBrainController],
  providers: [MatterBrainService],
  exports: [MatterBrainService],
})
export class MatterBrainModule {}
