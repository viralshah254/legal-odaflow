import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { DocumentAutomationService, type MergeFieldContext } from './document-automation.service';

@Controller('document-automation')
@UseGuards(TenantGuard)
export class DocumentAutomationController {
  constructor(private readonly documentAutomation: DocumentAutomationService) {}

  @Post('templates/:templateId/assemble')
  assemble(
    @TenantId() tenantId: string,
    @Param('templateId') templateId: string,
    @Body() body: { answers: Record<string, string | boolean>; context?: MergeFieldContext },
  ) {
    return this.documentAutomation.assembleFromQuestionnaire(
      tenantId,
      templateId,
      body.answers,
      body.context ?? {},
    );
  }
}
