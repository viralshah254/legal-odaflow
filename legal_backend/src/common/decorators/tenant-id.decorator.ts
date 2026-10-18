import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Returns only tenant IDs that were resolved by TenantGuard or encoded in route
 * params. Do not read x-tenant-id here directly: header membership validation
 * belongs in TenantGuard, which sets request.tenantId after checking tenantUser.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      params: Record<string, string>;
      tenantId?: string;
    }>();

    if (request.tenantId) {
      return request.tenantId;
    }

    return request.params.tenantId;
  },
);
