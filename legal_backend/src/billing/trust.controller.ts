import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Patch } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TrustService } from './invoices.service';
import {
  CreateTrustAccountDto,
  CreateTrustEntryDto,
  ReviewTrustEntryDto,
} from './dto/create-invoice.dto';

@Controller('billing/trust')
@UseGuards(TenantGuard)
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Post('accounts')
  createAccount(@TenantId() tenantId: string, @Body() dto: CreateTrustAccountDto) {
    return this.trustService.createAccount(tenantId, dto);
  }

  @Get('accounts')
  listAccounts(@TenantId() tenantId: string) {
    return this.trustService.listAccounts(tenantId);
  }

  @Get('accounts/:accountId')
  getAccount(@TenantId() tenantId: string, @Param('accountId') accountId: string) {
    return this.trustService.getAccount(tenantId, accountId);
  }

  @Post('accounts/:accountId/entries')
  addEntry(
    @TenantId() tenantId: string,
    @Param('accountId') accountId: string,
    @Body() dto: CreateTrustEntryDto,
  ) {
    return this.trustService.addEntry(tenantId, accountId, dto);
  }

  @Patch('entries/:entryId/approve')
  approveEntry(
    @TenantId() tenantId: string,
    @Param('entryId') entryId: string,
    @Body() dto: ReviewTrustEntryDto,
  ) {
    return this.trustService.approveEntry(tenantId, entryId, dto.note);
  }

  @Patch('entries/:entryId/reject')
  rejectEntry(
    @TenantId() tenantId: string,
    @Param('entryId') entryId: string,
    @Body() dto: ReviewTrustEntryDto,
  ) {
    return this.trustService.rejectEntry(tenantId, entryId, dto.note);
  }
}
