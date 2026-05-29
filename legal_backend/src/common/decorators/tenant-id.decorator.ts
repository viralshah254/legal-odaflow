import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      tenantId?: string;
    }>();

    if (request.tenantId) {
      return request.tenantId;
    }

    const headerValue = request.headers['x-tenant-id'];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return headerValue ?? request.params.tenantId;
  },
);
