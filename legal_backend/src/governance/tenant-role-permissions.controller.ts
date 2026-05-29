import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import {
  TenantRolePermissionsMap,
  TenantRolePermissionsService,
} from './tenant-role-permissions.service';

@Controller('governance/role-permissions')
@UseGuards(TenantGuard)
export class TenantRolePermissionsController {
  constructor(private readonly rolePermissionsService: TenantRolePermissionsService) {}

  @Get()
  getPermissions(@TenantId() tenantId: string): Promise<TenantRolePermissionsMap> {
    return this.rolePermissionsService.getPermissions(tenantId);
  }

  @Put()
  updatePermissions(
    @TenantId() tenantId: string,
    @Body() body: TenantRolePermissionsMap,
  ): Promise<TenantRolePermissionsMap> {
    return this.rolePermissionsService.updatePermissions(tenantId, body);
  }
}
