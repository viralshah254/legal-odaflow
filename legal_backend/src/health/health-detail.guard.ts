import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { RequestUser } from '@/common/types/request-user.interface';

@Injectable()
export class HealthDetailGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();

    if (request.user?.userType === 'SUPER_ADMIN') {
      return true;
    }

    const configuredToken = this.configService.get<string>('HEALTH_DETAIL_TOKEN', '').trim();
    if (!configuredToken) {
      throw new ForbiddenException('Health detail access is not configured');
    }

    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      throw new ForbiddenException('Health detail bearer token required');
    }

    const provided = Buffer.from(token);
    const expected = Buffer.from(configuredToken);

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ForbiddenException('Invalid health detail bearer token');
    }

    return true;
  }
}
