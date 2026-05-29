import { Module } from '@nestjs/common';
import { DocumentAutomationController } from './document-automation.controller';
import { DocumentAutomationService } from './document-automation.service';

@Module({
  controllers: [DocumentAutomationController],
  providers: [DocumentAutomationService],
  exports: [DocumentAutomationService],
})
export class DocumentAutomationModule {}
