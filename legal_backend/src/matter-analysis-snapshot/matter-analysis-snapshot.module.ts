import { Module } from '@nestjs/common';
import { MatterAutonomyModule } from '@/matter-autonomy/matter-autonomy.module';
import { MatterAnalysisSnapshotController } from './matter-analysis-snapshot.controller';
import { MatterAnalysisSnapshotService } from './matter-analysis-snapshot.service';

@Module({
  imports: [MatterAutonomyModule],
  controllers: [MatterAnalysisSnapshotController],
  providers: [MatterAnalysisSnapshotService],
  exports: [MatterAnalysisSnapshotService],
})
export class MatterAnalysisSnapshotModule {}
