import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { StatementsService } from './statements.service';

@Controller('billing/statements')
@UseGuards(TenantGuard)
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get()
  getStatement(@TenantId() tenantId: string, @Query('clientId') clientId?: string) {
    return this.statements.getClientStatement(tenantId, clientId);
  }
}
