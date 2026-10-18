import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DomainErrorCode } from '@/common/errors/domain-errors';
import { EthicalWallService } from './ethical-wall.service';

@Injectable()
export class EthicalWallGuard implements CanActivate {
  constructor(private readonly ethicalWallService: EthicalWallService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string; tenantId?: string };
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    const user = request.user;
    const userId = user?.id;
    const tenantId = user?.tenantId;

    if (!userId || !tenantId) {
      return true;
    }

    const matterId: string | undefined =
      (request.params?.['matterId'] as string | undefined) ??
      (request.params?.['id'] as string | undefined) ??
      (request.body?.['matterId'] as string | undefined);

    if (!matterId) {
      return true;
    }

    const result = await this.ethicalWallService.checkAccess(tenantId, userId, matterId);

    if (!result.allowed) {
      throw new ForbiddenException({
        code: DomainErrorCode.ETHICAL_WALL_VIOLATION,
        message: 'Access denied: ethical wall restriction in effect',
        wallId: result.wallId,
      });
    }

    return true;
  }
}
