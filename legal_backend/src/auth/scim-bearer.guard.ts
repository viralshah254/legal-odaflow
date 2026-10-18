import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ScimBearerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantIdParam = request.params.tenantId;
    const tenantId = Array.isArray(tenantIdParam) ? tenantIdParam[0] : tenantIdParam;

    if (!tenantId) {
      throw new UnauthorizedException('SCIM bearer token required');
    }

    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      throw new UnauthorizedException('SCIM bearer token required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, ssoConfig: true, isActive: true },
    });

    if (!tenant?.isActive) {
      throw new NotFoundException('Tenant not found');
    }

    const ssoConfig = tenant.ssoConfig as Record<string, unknown> | null;
    if (!ssoConfig?.scimEnabled) {
      throw new UnauthorizedException('SCIM is not enabled for this tenant');
    }

    const configuredToken = ssoConfig.scimBearerToken;
    if (typeof configuredToken !== 'string' || !configuredToken.trim()) {
      throw new UnauthorizedException('SCIM bearer token is not configured');
    }

    const provided = Buffer.from(token);
    const expected = Buffer.from(configuredToken.trim());

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid SCIM bearer token');
    }

    return true;
  }
}
