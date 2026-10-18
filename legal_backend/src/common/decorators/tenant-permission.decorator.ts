import { SetMetadata } from '@nestjs/common';
import type { FlatRolePermissionKey } from '@/governance/tenant-role-permissions.service';

export const TENANT_PERMISSION_KEY = 'tenantPermission';

export const TenantPermission = (permission: FlatRolePermissionKey) =>
  SetMetadata(TENANT_PERMISSION_KEY, permission);
