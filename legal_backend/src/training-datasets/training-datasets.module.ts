import { Module } from '@nestjs/common';
import { TrainingDatasetsController } from './training-datasets.controller';
import { TrainingDatasetsService } from './training-datasets.service';

@Module({
  controllers: [TrainingDatasetsController],
  providers: [TrainingDatasetsService],
  exports: [TrainingDatasetsService],
})
export class TrainingDatasetsModule {}
