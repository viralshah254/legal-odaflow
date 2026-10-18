import { Module } from '@nestjs/common';
import { MeCountsController } from './me-counts.controller';
import { MeCountsService } from './me-counts.service';

@Module({
  controllers: [MeCountsController],
  providers: [MeCountsService],
  exports: [MeCountsService],
})
export class MeCountsModule {}
