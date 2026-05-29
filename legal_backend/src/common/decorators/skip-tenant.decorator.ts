import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';

/** Allows authenticated lawyer routes without X-Tenant-Id (e.g. listing memberships). */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
