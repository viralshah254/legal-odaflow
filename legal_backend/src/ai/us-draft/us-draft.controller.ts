import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { UsDraftService } from './us-draft.service';
import { FillUsBlanksDto, GenerateUsDraftDto, EnrichUsDraftDto } from './us-draft.dto';

@Controller('ai/us-draft')
@UseGuards(TenantGuard)
export class UsDraftController {
  constructor(private readonly svc: UsDraftService) {}

  @Post('generate')
  generateDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateUsDraftDto,
  ) {
    return this.svc.generateDraft(dto, { userId: user.id, tenantId });
  }

  @Post('fill-blanks')
  fillBlanks(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: FillUsBlanksDto,
  ) {
    return this.svc.fillBlanks(dto, { userId: user.id, tenantId });
  }

  @Post('enrich')
  enrichDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: EnrichUsDraftDto,
  ) {
    return this.svc.enrichDraft(dto, { userId: user.id, tenantId });
  }
}
