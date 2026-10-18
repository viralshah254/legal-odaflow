import { Module } from '@nestjs/common';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { TemplatesController } from './templates.controller';
import { TemplateLibraryService } from './template-library.service';
import { TemplateSelectionService } from './template-selection.service';
import { TemplatesService } from './templates.service';

@Module({
  imports: [MatterIntelligencePlatformModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateLibraryService, TemplateSelectionService],
  exports: [TemplatesService, TemplateLibraryService, TemplateSelectionService],
})
export class TemplatesModule {}
