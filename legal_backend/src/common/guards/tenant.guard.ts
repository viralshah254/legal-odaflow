import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      headers: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      tenantId?: string;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.userType === 'CONSUMER') {
      return true;
    }

    const headerValue = request.headers['x-tenant-id'];
    const tenantId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue ?? request.params.tenantId ?? user.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('X-Tenant-Id header is required');
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this tenant');
    }

    request.tenantId = tenantId;
    user.tenantId = tenantId;
    user.tenantRole = membership.role;

    return true;
  }
}
