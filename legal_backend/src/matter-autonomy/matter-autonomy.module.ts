import { Module } from '@nestjs/common';
import { MatterAutonomyService } from './matter-autonomy.service';

@Module({
  providers: [MatterAutonomyService],
  exports: [MatterAutonomyService],
})
export class MatterAutonomyModule {}
