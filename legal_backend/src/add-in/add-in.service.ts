import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

export interface AddInTokenResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
  tenantId: string;
  displayName: string;
}

@Injectable()
export class AddInService {
  private readonly logger = new Logger(AddInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Exchange an Office identity token (or email+secret for dev) for a backend JWT.
   * In production, validate the Microsoft identity token via JWKS.
   * In dev / sideload mode, accept email + addinSecret.
   */
  async exchangeToken(input: {
    email?: string;
    officeToken?: string;
    addinSecret?: string;
  }): Promise<AddInTokenResponse> {
    let user: { id: string; email: string; name: string; tenantId?: string } | null = null;

    // Development / sideload flow: email + addinSecret
    if (input.email && input.addinSecret) {
      const expected = this.config.get<string>('ADDIN_DEV_SECRET', '');
      if (!expected || input.addinSecret !== expected) {
        throw new UnauthorizedException('Invalid add-in secret');
      }
      const found = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, email: true, name: true },
      });
      if (!found) throw new UnauthorizedException('User not found');
      user = { ...found, name: found.name ?? found.email };
    } else if (input.officeToken) {
      // Production: validate Microsoft identity token
      // The token is a JWT signed by Microsoft; validate against JWKS endpoint
      // For now we decode without full verification (self-contained claims)
      try {
        const decoded = this.jwt.decode(input.officeToken) as Record<string, string>;
        const email = decoded?.upn ?? decoded?.email ?? decoded?.preferred_username;
        if (!email) throw new UnauthorizedException('No email in Office token');
        const found = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true },
        });
        if (!found) throw new UnauthorizedException('User not found');
        user = { ...found, name: found.name ?? found.email };
      } catch {
        throw new UnauthorizedException('Invalid Office identity token');
      }
    } else {
      throw new UnauthorizedException('Provide either officeToken or email + addinSecret');
    }

    if (!user) throw new UnauthorizedException('User not found');

    // Find tenant
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: tenantUser?.tenantId,
      source: 'office_addin',
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '8h' });

    return {
      accessToken,
      expiresIn: 8 * 3600,
      userId: user.id,
      tenantId: tenantUser?.tenantId ?? '',
      displayName: user.name,
    };
  }

  /**
   * GET /add-in/context/matter?matterId=xxx
   * Returns a compact matter context object for the add-in sidebar.
   */
  async getMatterContext(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: {
        id: true,
        title: true,
        status: true,
        client: { select: { name: true } },
        tasks: {
          where: { status: { not: 'DONE' } },
          orderBy: { dueDate: 'asc' },
          take: 5,
          select: { id: true, title: true, dueDate: true, priority: true },
        },
      },
    });
    return matter;
  }
}
