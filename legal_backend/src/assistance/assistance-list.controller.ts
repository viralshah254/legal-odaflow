import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AssistanceService } from './assistance.service';

@Controller('assistance')
@UseGuards(TenantGuard)
export class AssistanceListController {
  constructor(private readonly assistanceService: AssistanceService) {}

  @Get('pending')
  listPending(@TenantId() tenantId: string) {
    return this.assistanceService.listPending(tenantId);
  }
}
