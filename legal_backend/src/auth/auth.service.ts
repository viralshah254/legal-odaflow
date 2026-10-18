import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { getCountryConfig } from '@/config/countries';
import { resolveConsumerSignupCredits, resolveLawyerSignupCredits } from '@/config/pricing.config';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { JwtPayload } from '@/common/types/request-user.interface';
import { resolveRefreshTokenPepper } from './auth-secrets.util';
import { hashRefreshToken } from './refresh-token.util';
import {
  TENANT_ROLES,
  TENANT_TYPES,
  USER_TYPES,
} from './constants';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SamlLoginDto } from './dto/saml-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SamlService } from './saml.service';
import { ReferralsService } from '@/referrals/referrals.service';
import { ensureFirstLoginRecorded } from '@/users/first-login.util';
import { PasswordPolicyService } from './password/password-policy.service';
import {
  authUserLoginSelect,
  authUserPasswordChangeSelect,
  authUserSessionSelect,
  buildPasswordChangeUpdate,
  type AuthUserSession,
} from './auth-user.select';
import { mapProspectToPrefill, type ProspectPrefill } from '@/admin/prospect-prefill.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly referralsService: ReferralsService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly samlService: SamlService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    await this.passwordPolicy.assertValidIncludingBreachCheck(dto.password, {
      email: dto.email,
      name: dto.name,
      firmName: dto.firmName,
      phone: dto.phone,
    });

    const country = getCountryConfig(dto.countryCode);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.userType === USER_TYPES.CONSUMER) {
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
              aiCreditsRemaining: 0,
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

      await this.grantConsumerSignupCredits(user.id);

      // Apply referral attribution silently (non-fatal)
      if (dto.referralCode) {
        try {
          await this.referralsService.applyReferralCode({
            refereeUserId: user.id,
            code: dto.referralCode.toUpperCase(),
            deviceFingerprint: dto.deviceFingerprint,
          });
        } catch (err) {
          this.logger.warn(`Referral apply failed for consumer ${user.id}: ${String(err)}`);
        }
      } else if (dto.deviceFingerprint) {
        await this.referralsService.registerDeviceFingerprint(
          user.id,
          dto.deviceFingerprint,
          'signup',
        ).catch(() => undefined);
      }

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
          billingPlan: 'TRIAL_PENDING_PAYMENT',
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

    await this.grantLawyerSignupCredits(user.tenantId);

    // Apply referral attribution for lawyer registration (non-fatal)
    if (dto.referralCode) {
      try {
        await this.referralsService.applyReferralCode({
          refereeUserId: user.id,
          code: dto.referralCode.toUpperCase(),
          deviceFingerprint: dto.deviceFingerprint,
        });
      } catch (err) {
        this.logger.warn(`Referral apply failed for lawyer ${user.id}: ${String(err)}`);
      }
    } else if (dto.deviceFingerprint) {
      await this.referralsService.registerDeviceFingerprint(
        user.id,
        dto.deviceFingerprint,
        'signup',
      ).catch(() => undefined);
    }

    if (dto.userType === USER_TYPES.LAWYER) {
      await this.markProspectConverted(dto.email);
    }

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
    phone?: string;
    referralCode?: string;
    deviceFingerprint?: string;
  }) {
    const userType = params.userType ?? USER_TYPES.CONSUMER;
    const countryCode = params.countryCode ?? 'US';
    const country = getCountryConfig(countryCode);
    const jurisdiction = params.jurisdiction?.trim() || null;

    if (userType === USER_TYPES.CONSUMER) {
      const user = await this.prisma.user.create({
        data: {
          email: params.email.toLowerCase(),
          firebaseUid: params.firebaseUid,
          name: params.name,
          phone: params.phone,
          userType: USER_TYPES.CONSUMER,
          countryCode: country.code,
          jurisdiction,
          consumerProfile: {
            create: {
              countryCode: country.code,
              stateOrCounty: jurisdiction,
              subscriptionStatus: 'FREE',
              aiCreditsRemaining: 0,
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

      await this.grantConsumerSignupCredits(user.id);

      // Apply referral attribution silently (non-fatal)
      if (params.referralCode) {
        try {
          await this.referralsService.applyReferralCode({
            refereeUserId: user.id,
            code: params.referralCode.toUpperCase(),
            deviceFingerprint: params.deviceFingerprint,
          });
        } catch (err) {
          this.logger.warn(`Referral apply failed for Firebase consumer ${user.id}: ${String(err)}`);
        }
      } else if (params.deviceFingerprint) {
        await this.referralsService.registerDeviceFingerprint(
          user.id,
          params.deviceFingerprint,
          'signup',
        ).catch(() => undefined);
      }

      return user;
    }

    if (!params.firmName?.trim()) {
      throw new BadRequestException('firmName is required for lawyer registration');
    }

    const lawyerJurisdictions = jurisdiction
      ? [jurisdiction, ...country.supportedJurisdictions.filter((j) => j !== jurisdiction).slice(0, 2)]
      : country.supportedJurisdictions.slice(0, 3);

    const lawyerUser = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: params.email.toLowerCase(),
          firebaseUid: params.firebaseUid,
          name: params.name,
          phone: params.phone,
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
          billingPlan: 'TRIAL_PENDING_PAYMENT',
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

    await this.grantLawyerSignupCredits(lawyerUser.tenantId);

    // Apply referral attribution for Firebase lawyer registration (non-fatal)
    if (params.referralCode) {
      try {
        await this.referralsService.applyReferralCode({
          refereeUserId: lawyerUser.id,
          code: params.referralCode.toUpperCase(),
          deviceFingerprint: params.deviceFingerprint,
        });
      } catch (err) {
        this.logger.warn(`Referral apply failed for Firebase lawyer ${lawyerUser.id}: ${String(err)}`);
      }
    } else if (params.deviceFingerprint) {
      await this.referralsService.registerDeviceFingerprint(
        lawyerUser.id,
        params.deviceFingerprint,
        'signup',
      ).catch(() => undefined);
    }

    await this.markProspectConverted(params.email);

    return lawyerUser;
  }

  /** Used by clients when Firebase has no sign-in methods for a backend-only password account. */
  async lookupEmail(
    email: string,
  ): Promise<{
    exists: boolean;
    hasPassword: boolean;
    hasFirebaseAccount: boolean;
    prospectPrefill?: ProspectPrefill;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { isActive: true, passwordHash: true, firebaseUid: true },
    });
    if (user?.isActive) {
      return {
        exists: true,
        hasPassword: Boolean(user.passwordHash),
        hasFirebaseAccount: Boolean(user.firebaseUid),
      };
    }

    const prospect = await this.prisma.lawyerProspect.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      exists: false,
      hasPassword: false,
      hasFirebaseAccount: false,
      prospectPrefill: prospect ? mapProspectToPrefill(prospect) : undefined,
    };
  }

  private async markProspectConverted(email: string): Promise<void> {
    await this.prisma.lawyerProspect.updateMany({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
      data: { outreachStatus: 'CONVERTED' },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: authUserLoginSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google or Apple sign-in. Use those options instead of a password.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return this.buildAuthResponse(this.toAuthResponsePayload(user));
  }

  async refresh(dto: RefreshDto) {
    const storedToken = await this.findStoredRefreshToken(dto.refreshToken);

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = storedToken.user;

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.buildAuthResponse(this.toAuthResponsePayload(user));
  }

  async logout(refreshToken: string) {
    const hashed = this.hashRefreshTokenValue(refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ token: hashed }, { token: refreshToken }] },
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserPasswordChangeSelect,
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Account cannot change password');
    }

    const currentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    await this.passwordPolicy.assertValidIncludingBreachCheck(dto.newPassword, {
      email: user.email,
      name: user.name ?? undefined,
      phone: user.phone ?? undefined,
    });

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: buildPasswordChangeUpdate(passwordHash),
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    return this.buildAuthResponse({
      ...this.toAuthResponsePayload(user),
      mustChangePassword: false,
    });
  }

  /** Validates tenant SAML/SSO config; exchanges assertion when provided. */
  async samlLogin(dto: SamlLoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true, name: true, ssoConfig: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Tenant not found');
    }

    const ssoConfig = tenant.ssoConfig as Record<string, unknown> | null;
    this.samlService.assertSsoConfigReady(ssoConfig);

    const idpEntityId = (ssoConfig!.idpEntityId as string).trim();
    const ssoUrl = (ssoConfig!.ssoUrl as string).trim();
    const spEntityId = this.samlService.buildSpEntityId(tenant.id, ssoConfig ?? undefined);
    const acsUrl = this.samlService.buildAcsUrl();

    if (dto.samlResponse?.trim()) {
      return this.exchangeSamlAssertion(tenant.id, dto.samlResponse.trim(), dto.relayState);
    }

    return {
      status: 'redirect',
      tenantId: tenant.id,
      tenantName: tenant.name,
      provider: 'saml',
      idpEntityId,
      spEntityId,
      redirectUrl: ssoUrl,
      relayState: dto.relayState,
      message: 'Redirect user to IdP SSO URL; POST SAMLResponse to ACS URL',
      acsUrl,
    };
  }

  /** ACS endpoint — accepts SAMLResponse and issues JWT tokens. */
  async samlAcs(dto: SamlLoginDto) {
    if (!dto.samlResponse?.trim()) {
      throw new BadRequestException('samlResponse is required');
    }
    return this.exchangeSamlAssertion(dto.tenantId, dto.samlResponse.trim(), dto.relayState);
  }

  private async exchangeSamlAssertion(
    tenantId: string,
    samlResponse: string,
    relayState?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, ssoConfig: true, isActive: true },
    });

    if (!tenant?.isActive) {
      throw new NotFoundException('Tenant not found');
    }

    const ssoConfig = tenant.ssoConfig as Record<string, unknown> | null;
    this.samlService.assertSsoConfigReady(ssoConfig);

    const email = await this.samlService.validateAssertionAndExtractEmail(
      tenantId,
      samlResponse,
      ssoConfig!,
    );

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          userType: 'LAWYER',
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        },
      });
    }

    await this.prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: 'ASSOCIATE', status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    const tokens = await this.issueTokensForUser(user.id);
    return {
      ...tokens,
      provider: 'saml',
      relayState,
      status: 'authenticated',
    };
  }

  /** SCIM 2.0 user provision stub — creates tenant user when bearer token matches tenant config. */
  async scimProvisionUser(
    tenantId: string,
    body: { userName: string; name?: { givenName?: string; familyName?: string }; active?: boolean },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, ssoConfig: true, isActive: true },
    });
    if (!tenant?.isActive) {
      throw new NotFoundException('Tenant not found');
    }
    const ssoConfig = tenant.ssoConfig as Record<string, unknown> | null;
    if (!ssoConfig?.scimEnabled) {
      throw new BadRequestException('SCIM is not enabled for this tenant');
    }

    const email = body.userName.toLowerCase();
    const displayName =
      [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ') ||
      email.split('@')[0];

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName,
          userType: 'LAWYER',
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        },
      });
    }

    await this.prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: {
        tenantId,
        userId: user.id,
        role: 'ASSOCIATE',
        status: body.active === false ? 'INACTIVE' : 'ACTIVE',
      },
      update: {
        status: body.active === false ? 'INACTIVE' : 'ACTIVE',
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: email,
      active: body.active !== false,
      meta: { resourceType: 'User' },
    };
  }

  async issueTokensForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSessionSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildAuthResponse(this.toAuthResponsePayload(user));
  }

  private toAuthResponsePayload(user: AuthUserSession) {
    const primaryMembership = user.tenantUsers[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      countryCode: user.countryCode,
      tenantId: primaryMembership?.tenantId,
      tenantRole: primaryMembership?.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    userType: string;
    countryCode: string | null;
    tenantId?: string;
    tenantRole?: string;
    mustChangePassword?: boolean;
  }) {
    await ensureFirstLoginRecorded(this.prisma, user.id);

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
        mustChangePassword: user.mustChangePassword ?? false,
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
        token: this.hashRefreshTokenValue(token),
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Applies a referral code to an existing user who did not get one at signup
   * (e.g. an existing Firebase account re-logging in with a ?ref= link).
   * Non-fatal — errors are only logged.
   */
  async applyReferralCodeIfMissing(
    userId: string,
    referralCode: string,
    deviceFingerprint?: string,
  ): Promise<void> {
    // Check if the user already has a referral to avoid double-attribution
    const existing = await this.prisma.referral.findUnique({
      where: { refereeUserId: userId },
      select: { id: true },
    });
    if (existing) return;

    try {
      await this.referralsService.applyReferralCode({
        refereeUserId: userId,
        code: referralCode.toUpperCase(),
        deviceFingerprint,
      });
    } catch (err) {
      this.logger.warn(
        `Referral apply failed for existing user ${userId}: ${String(err)}`,
      );
    }
  }

  private async grantConsumerSignupCredits(userId: string): Promise<void> {
    const signupCredits = resolveConsumerSignupCredits(
      this.configService.get<string>('CONSUMER_SIGNUP_CREDITS'),
    );
    try {
      await this.creditLedger.credit({
        userId,
        taskType: 'signup_bonus',
        credits: signupCredits,
        metadata: { source: 'consumer_signup' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to grant consumer signup credits for user ${userId}: ${String(err)}`,
      );
    }
  }

  private async grantLawyerSignupCredits(tenantId: string): Promise<void> {
    const signupCredits = resolveLawyerSignupCredits(
      this.configService.get<string>('LAWYER_SIGNUP_CREDITS'),
      this.configService.get<string>('CONSUMER_SIGNUP_CREDITS'),
    );
    try {
      await this.creditLedger.credit({
        tenantId,
        taskType: 'signup_bonus',
        credits: signupCredits,
        metadata: { source: 'lawyer_signup' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to grant lawyer signup credits for tenant ${tenantId}: ${String(err)}`,
      );
    }
  }

  private hashRefreshTokenValue(token: string): string {
    return hashRefreshToken(token, resolveRefreshTokenPepper(this.configService));
  }

  private async findStoredRefreshToken(plainToken: string) {
    const include = {
      user: {
        include: {
          tenantUsers: {
            where: { status: 'ACTIVE' as const },
            orderBy: { createdAt: 'asc' as const },
            take: 1,
          },
        },
      },
    };

    const hashed = this.hashRefreshTokenValue(plainToken);
    const byHash = await this.prisma.refreshToken.findUnique({
      where: { token: hashed },
      include,
    });
    if (byHash) {
      return byHash;
    }

    // Legacy plaintext tokens issued before BE-M-02
    return this.prisma.refreshToken.findUnique({
      where: { token: plainToken },
      include,
    });
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
