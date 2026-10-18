import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload, RequestUser } from '@/common/types/request-user.interface';
import { resolveJwtSecret } from './auth-secrets.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        countryCode: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    let tenantId = payload.tenantId;
    let tenantRole = payload.tenantRole;

    if (tenantId && user.userType !== 'CONSUMER') {
      const membership = await this.prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant membership is no longer active');
      }

      tenantRole = membership.role;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      countryCode: user.countryCode,
      tenantId,
      tenantRole,
    };
  }
}
