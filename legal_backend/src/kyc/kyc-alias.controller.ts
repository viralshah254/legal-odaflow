import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  InitializeKycClientDto,
  UpdateKycDocumentByTypeDto,
} from './dto/kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
@UseGuards(TenantGuard)
export class KycAliasController {
  constructor(private readonly kycService: KycService) {}

  @Get('clients/:clientId')
  getClientChecklist(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.kycService.getClientChecklist(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
    );
  }

  @Post('clients/:clientId/initialize')
  initializeClientKyc(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: InitializeKycClientDto,
  ) {
    return this.kycService.initializeClientChecklist(
      tenantId,
      clientId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Patch('clients/:clientId/documents/:docType')
  updateDocumentByType(
    @TenantId() tenantId: string,
    @Param('clientId') clientId: string,
    @Param('docType') docType: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateKycDocumentByTypeDto,
  ) {
    return this.kycService.updateDocumentByType(
      tenantId,
      clientId,
      docType,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Get('alerts/missing')
  listMissingAlerts(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.kycService.listMissingAlerts(tenantId, user.id, user.tenantRole);
  }

  @Get('alerts/expired')
  listExpiredAlerts(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.kycService.listExpiredAlerts(tenantId, user.id, user.tenantRole);
  }
}
