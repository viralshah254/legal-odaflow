import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { getCountryConfig } from '@/config/countries';
import { getDefaultConsumerFreePlan } from '@/config/pricing.config';
import { JwtPayload } from '@/common/types/request-user.interface';
import {
  TENANT_ROLES,
  TENANT_TYPES,
  USER_TYPES,
} from './constants';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const country = getCountryConfig(dto.countryCode);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.userType === USER_TYPES.CONSUMER) {
      const freePlan = getDefaultConsumerFreePlan(country.code);
      const jurisdiction = dto.jurisdiction?.trim() || null;

      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          userType: USER_TYPES.CONSUMER,
          countryCode: country.code,
          jurisdiction,
          consumerProfile: {
            create: {
              countryCode: country.code,
              stateOrCounty: jurisdiction,
              subscriptionStatus: 'FREE',
              aiCreditsRemaining: freePlan.aiCredits,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          userType: true,
          countryCode: true,
        },
      });

      return this.buildAuthResponse(user);
    }

    if (!dto.firmName) {
      throw new ConflictException('firmName is required for lawyer registration');
    }

    const requirePaymentMethod =
      this.configService.get<string>(
        'REQUIRE_PAYMENT_METHOD_FOR_LAWYER_TRIAL',
        'false',
      ) === 'true';

    if (requirePaymentMethod && !dto.paymentMethodId?.trim()) {
      throw new BadRequestException(
        'A payment method is required to start the lawyer trial. Provide paymentMethodId from your payment provider.',
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const jurisdiction = dto.jurisdiction?.trim() || null;
      const lawyerJurisdictions = jurisdiction
        ? [jurisdiction, ...country.supportedJurisdictions.filter((j) => j !== jurisdiction).slice(0, 2)]
        : country.supportedJurisdictions.slice(0, 3);

      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          userType: USER_TYPES.LAWYER,
          countryCode: country.code,
          jurisdiction,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: dto.firmName!,
          type: TENANT_TYPES.LAW_FIRM,
          primaryCountry: country.code,
          defaultCurrency: country.currency,
          dataRegion: country.dataRegion,
          billingPlan: requirePaymentMethod ? 'TRIAL_PENDING_PAYMENT' : 'STARTER',
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: createdUser.id,
          role: TENANT_ROLES.FIRM_ADMIN,
          status: 'ACTIVE',
        },
      });

      await tx.lawyerProfile.create({
        data: {
          userId: createdUser.id,
          tenantId: tenant.id,
          countryCode: country.code,
          practiceAreas: ['General Practice'],
          jurisdictions: lawyerJurisdictions,
          languages: [country.defaultLocale.split('-')[0]],
          currency: country.currency,
          acceptsLeads: true,
        },
      });

      return {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        userType: createdUser.userType,
        countryCode: createdUser.countryCode,
        tenantId: tenant.id,
        tenantRole: TENANT_ROLES.FIRM_ADMIN,
      };
    });

    return this.buildAuthResponse(user);
  }

  async provisionFirebaseUser(params: {
    email: string;
    firebaseUid: string;
    name?: string | null;
    userType?: string;
    countryCode?: string;
    jurisdiction?: string;
    firmName?: string;
  }) {
    const userType = params.userType ?? USER_TYPES.CONSUMER;
    const countryCode = params.countryCode ?? 'US';
    const country = getCountryConfig(countryCode);
    const jurisdiction = params.jurisdiction?.trim() || null;

    if (userType === USER_TYPES.CONSUMER) {
      const freePlan = getDefaultConsumerFreePlan(country.code);

      const user = await this.prisma.user.create({
        data: {
          email: params.email.toLowerCase(),
          firebaseUid: params.firebaseUid,
          name: params.name,
          userType: USER_TYPES.CONSUMER,
          countryCode: country.code,
          jurisdiction,
          consumerProfile: {
            create: {
              countryCode: country.code,
              stateOrCounty: jurisdiction,
              subscriptionStatus: 'FREE',
              aiCreditsRemaining: freePlan.aiCredits,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          userType: true,
          countryCode: true,
        },
      });

      return user;
    }

    if (!params.firmName?.trim()) {
      throw new BadRequestException('firmName is required for lawyer registration');
    }

    const lawyerJurisdictions = jurisdiction
      ? [jurisdiction, ...country.supportedJurisdictions.filter((j) => j !== jurisdiction).slice(0, 2)]
      : country.supportedJurisdictions.slice(0, 3);

    return this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: params.email.toLowerCase(),
          firebaseUid: params.firebaseUid,
          name: params.name,
          userType: USER_TYPES.LAWYER,
          countryCode: country.code,
          jurisdiction,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: params.firmName!.trim(),
          type: TENANT_TYPES.LAW_FIRM,
          primaryCountry: country.code,
          defaultCurrency: country.currency,
          dataRegion: country.dataRegion,
          billingPlan: 'STARTER',
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: createdUser.id,
          role: TENANT_ROLES.FIRM_ADMIN,
          status: 'ACTIVE',
        },
      });

      await tx.lawyerProfile.create({
        data: {
          userId: createdUser.id,
          tenantId: tenant.id,
          countryCode: country.code,
          practiceAreas: ['General Practice'],
          jurisdictions: lawyerJurisdictions,
          languages: [country.defaultLocale.split('-')[0]],
          currency: country.currency,
          acceptsLeads: true,
        },
      });

      return {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        userType: createdUser.userType,
        countryCode: createdUser.countryCode,
        tenantId: tenant.id,
        tenantRole: TENANT_ROLES.FIRM_ADMIN,
      };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        tenantUsers: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const primaryMembership = user.tenantUsers[0];

    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      countryCode: user.countryCode,
      tenantId: primaryMembership?.tenantId,
      tenantRole: primaryMembership?.role,
    });
  }

  async refresh(dto: RefreshDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: {
        user: {
          include: {
            tenantUsers: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = storedToken.user;
    const primaryMembership = user.tenantUsers[0];

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      countryCode: user.countryCode,
      tenantId: primaryMembership?.tenantId,
      tenantRole: primaryMembership?.role,
    });
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true };
  }

  async issueTokensForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const primaryMembership = user.tenantUsers[0];

    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      countryCode: user.countryCode,
      tenantId: primaryMembership?.tenantId,
      tenantRole: primaryMembership?.role,
    });
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    userType: string;
    countryCode: string | null;
    tenantId?: string;
    tenantRole?: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
      tenantId: user.tenantId,
      tenantRole: user.tenantRole,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        countryCode: user.countryCode,
        tenantId: user.tenantId,
        tenantRole: user.tenantRole,
      },
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const expiresIn = this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRES_IN',
      '30d',
    );
    const expiresAt = this.parseExpiry(expiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  private parseExpiry(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([dhm])$/);
    const now = new Date();

    if (!match) {
      now.setDate(now.getDate() + 30);
      return now;
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      default:
        now.setDate(now.getDate() + 30);
    }

    return now;
  }
}
