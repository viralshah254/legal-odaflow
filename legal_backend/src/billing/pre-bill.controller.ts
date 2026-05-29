import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { PreBillService } from './pre-bill.service';

@Controller('billing/pre-bill')
@UseGuards(TenantGuard)
export class PreBillController {
  constructor(private readonly preBillService: PreBillService) {}

  @Get()
  getReview(@TenantId() tenantId: string, @Query('matterId') matterId?: string) {
    return this.preBillService.getPreBillReview(tenantId, matterId);
  }

  @Post('sessions')
  createSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { matterId?: string; notes?: string },
  ) {
    return this.preBillService.createSession(tenantId, user.id, body);
  }

  @Patch('sessions/:sessionId')
  updateSession(
    @TenantId() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      writeDownPercent?: number;
      notes?: string;
      adjustments?: Array<{
        timeEntryId: string;
        adjustedMinutes?: number;
        writeDownPercent?: number;
        notes?: string;
      }>;
    },
  ) {
    return this.preBillService.updateSession(tenantId, sessionId, body);
  }

  @Get('ledes')
  @Header('Content-Type', 'text/csv')
  exportLedes(@TenantId() tenantId: string, @Query('matterId') matterId?: string) {
    return this.preBillService.buildLedesExport(tenantId, matterId).then((result) => result.csv);
  }
}
