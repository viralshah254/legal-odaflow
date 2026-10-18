import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { TenantPermission } from '@/common/decorators/tenant-permission.decorator';
import { TenantPermissionGuard } from '@/common/guards/tenant-permission.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import {
  TenantRolePermissionsMap,
  TenantRolePermissionsService,
} from './tenant-role-permissions.service';

@Controller('tenants/:tenantId/governance/role-permissions')
@UseGuards(TenantGuard, TenantPermissionGuard)
export class TenantRolePermissionsController {
  constructor(private readonly rolePermissionsService: TenantRolePermissionsService) {}

  @Get()
  getPermissions(@Param('tenantId') tenantId: string): Promise<TenantRolePermissionsMap> {
    return this.rolePermissionsService.getPermissions(tenantId);
  }

  @Put()
  @TenantPermission('canManageSettings')
  updatePermissions(
    @Param('tenantId') tenantId: string,
    @Body() body: TenantRolePermissionsMap,
  ): Promise<TenantRolePermissionsMap> {
    return this.rolePermissionsService.updatePermissions(tenantId, body);
  }
}
