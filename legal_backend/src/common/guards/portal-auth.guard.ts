import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface PortalRequestUser {
  clientId: string;
  tenantId: string;
  email: string;
  type: 'PORTAL';
}

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Portal token required');
    }

    try {
      const payload = this.jwtService.verify<PortalRequestUser>(token);
      if (payload.type !== 'PORTAL' || !payload.clientId || !payload.tenantId) {
        throw new UnauthorizedException('Invalid portal token');
      }
      (request as Request & { portalUser: PortalRequestUser }).portalUser =
        payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired portal token');
    }
  }
}
