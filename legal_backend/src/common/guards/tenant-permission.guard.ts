import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TENANT_PERMISSION_KEY,
} from '@/common/decorators/tenant-permission.decorator';
import {
  FlatRolePermissionKey,
  TenantRolePermissionsService,
} from '@/governance/tenant-role-permissions.service';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: TenantRolePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<FlatRolePermissionKey>(
      TENANT_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      tenantId?: string;
      user?: RequestUser;
    }>();
    const tenantId = request.tenantId ?? request.user?.tenantId;
    const role = request.user?.tenantRole;

    if (!tenantId || !role) {
      throw new ForbiddenException('Tenant role context is required');
    }

    const allowed = await this.permissions.hasPermission(
      tenantId,
      role,
      requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenException(`Missing tenant permission: ${requiredPermission}`);
    }

    return true;
  }
}
