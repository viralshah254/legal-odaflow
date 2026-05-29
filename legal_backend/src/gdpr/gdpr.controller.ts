import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { DeleteTenantDataDto } from './dto/delete-tenant.dto';
import { DeleteUserDataDto } from './dto/delete-user.dto';
import { GdprService } from './gdpr.service';

@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('users/me/export')
  exportMyData(@CurrentUser() user: RequestUser) {
    return this.gdprService.exportUserData(user.id);
  }

  @Post('users/me/delete')
  deleteMyData(@CurrentUser() user: RequestUser, @Body() dto: DeleteUserDataDto) {
    return this.gdprService.deleteUserData(user.id, dto.confirmEmail);
  }

  @Get('tenants/:tenantId/export')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('FIRM_ADMIN', 'PARTNER')
  exportTenant(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.gdprService.exportTenantData(tenantId, user.id);
  }

  @Delete('tenants/:tenantId')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('FIRM_ADMIN', 'PARTNER')
  deleteTenant(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteTenantDataDto,
  ) {
    return this.gdprService.deleteTenantData(
      tenantId,
      user.id,
      dto.confirmTenantName,
    );
  }
}
