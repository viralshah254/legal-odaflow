import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types/request-user.interface';

export interface RealtimeAuthResult {
  userId: string;
  tenantId: string;
  email: string;
}

@Injectable()
export class RealtimeAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticateHandshake(
    token: string | undefined,
    tenantId: string | undefined,
  ): Promise<RealtimeAuthResult> {
    if (!token) {
      throw new UnauthorizedException('Missing auth token');
    }
    if (!tenantId) {
      throw new UnauthorizedException('Missing tenantId');
    }

    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'change_me_dev_secret',
    );

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid auth token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('User inactive or not found');
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
      throw new UnauthorizedException('Not an active tenant member');
    }

    return {
      userId: user.id,
      tenantId,
      email: user.email,
    };
  }
}
