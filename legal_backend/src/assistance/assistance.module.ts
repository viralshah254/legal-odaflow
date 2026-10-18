import { Module } from '@nestjs/common';
import { AssistanceController } from './assistance.controller';
import { AssistanceListController } from './assistance-list.controller';
import { AssistanceService } from './assistance.service';

@Module({
  controllers: [AssistanceController, AssistanceListController],
  providers: [AssistanceService],
  exports: [AssistanceService],
})
export class AssistanceModule {}
