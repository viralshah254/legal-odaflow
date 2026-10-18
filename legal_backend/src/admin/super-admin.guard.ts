import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser } from '@/common/types/request-user.interface';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (request.user?.userType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
