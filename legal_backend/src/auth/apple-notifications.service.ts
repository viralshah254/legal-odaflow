import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { PrismaService } from '@/prisma/prisma.service';

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

type AppleNotificationEventType =
  | 'email-disabled'
  | 'email-enabled'
  | 'consent-revoked'
  | 'account-delete';

interface AppleNotificationEventPayload {
  type?: AppleNotificationEventType;
  sub?: string;
  email?: string;
  is_private_email?: string | boolean;
  event_time?: number;
}

interface AppleNotificationJwtPayload {
  iss: string;
  aud: string;
  iat: number;
  jti: string;
  events: string;
}

@Injectable()
export class AppleNotificationsService {
  private readonly logger = new Logger(AppleNotificationsService.name);
  private readonly jwks = jwksClient({
    jwksUri: APPLE_JWKS_URI,
    cache: true,
    rateLimit: true,
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleNotification(payload: string | undefined): Promise<void> {
    if (!payload?.trim()) {
      throw new BadRequestException('Missing Apple notification payload');
    }

    const decoded = await this.verifyPayload(payload.trim());
    const events = this.parseEvents(decoded.events);

    for (const [eventType, event] of Object.entries(events)) {
      await this.handleEvent(eventType as AppleNotificationEventType, event);
    }
  }

  private allowedAudiences(): string[] {
    const configured = this.configService.get<string>(
      'APPLE_NOTIFICATION_AUDIENCES',
      'com.dvtechventures.umbrella.signin,com.dvtechventures.umbrella',
    );

    return configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private async verifyPayload(token: string): Promise<AppleNotificationJwtPayload> {
    const decodedHeader = jwt.decode(token, { complete: true });
    const kid = decodedHeader?.header?.kid;
    if (!kid) {
      throw new UnauthorizedException('Invalid Apple notification token');
    }

    const signingKey = await this.jwks.getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();
    const audiences = this.allowedAudiences();

    try {
      const verified = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: audiences,
      }) as AppleNotificationJwtPayload;

      if (!verified.events) {
        throw new UnauthorizedException('Apple notification missing events');
      }

      return verified;
    } catch (error) {
      this.logger.warn(
        `Apple notification verification failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new UnauthorizedException('Invalid Apple notification token');
    }
  }

  private parseEvents(
    eventsJson: string,
  ): Record<string, AppleNotificationEventPayload> {
    try {
      const parsed = JSON.parse(eventsJson) as Record<
        string,
        AppleNotificationEventPayload
      >;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('events payload is not an object');
      }
      return parsed;
    } catch (error) {
      throw new BadRequestException(
        `Invalid Apple notification events payload: ${
          error instanceof Error ? error.message : 'parse error'
        }`,
      );
    }
  }

  private async handleEvent(
    eventType: AppleNotificationEventType,
    event: AppleNotificationEventPayload,
  ): Promise<void> {
    this.logger.log(
      `Apple notification ${eventType} sub=${event.sub ?? 'unknown'} email=${event.email ?? 'n/a'}`,
    );

    switch (eventType) {
      case 'consent-revoked':
      case 'account-delete':
        await this.deactivateUserForAppleEvent(event);
        return;
      case 'email-disabled':
        await this.markAppleEmailDisabled(event);
        return;
      case 'email-enabled':
        await this.updateAppleEmail(event);
        return;
      default:
        this.logger.warn(`Unhandled Apple notification type: ${eventType}`);
    }
  }

  private async findUserForEvent(
    event: AppleNotificationEventPayload,
  ): Promise<{ id: string; email: string } | null> {
    if (event.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: event.email.toLowerCase() },
        select: { id: true, email: true },
      });
      if (byEmail) return byEmail;
    }

    if (event.sub) {
      const byFirebaseUid = await this.prisma.user.findFirst({
        where: { firebaseUid: event.sub },
        select: { id: true, email: true },
      });
      if (byFirebaseUid) return byFirebaseUid;
    }

    return null;
  }

  private async deactivateUserForAppleEvent(
    event: AppleNotificationEventPayload,
  ): Promise<void> {
    const user = await this.findUserForEvent(event);
    if (!user) {
      this.logger.warn(
        `Apple ${event.type ?? 'lifecycle'} notification: no matching user`,
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    this.logger.log(`Deactivated user ${user.id} after Apple ${event.type}`);
  }

  private async markAppleEmailDisabled(
    event: AppleNotificationEventPayload,
  ): Promise<void> {
    const user = await this.findUserForEvent(event);
    if (!user) {
      this.logger.warn('Apple email-disabled notification: no matching user');
      return;
    }

    this.logger.log(
      `Apple relay disabled for user ${user.id}; sign-in may fail until user re-authorizes`,
    );
  }

  private async updateAppleEmail(
    event: AppleNotificationEventPayload,
  ): Promise<void> {
    const nextEmail = event.email?.trim().toLowerCase();
    if (!nextEmail) return;

    const user = await this.findUserForEvent(event);
    if (!user) {
      this.logger.warn('Apple email-enabled notification: no matching user');
      return;
    }

    if (user.email === nextEmail) return;

    const conflict = await this.prisma.user.findUnique({
      where: { email: nextEmail },
      select: { id: true },
    });
    if (conflict && conflict.id !== user.id) {
      this.logger.warn(
        `Apple email-enabled notification: ${nextEmail} already belongs to another user`,
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { email: nextEmail },
    });

    this.logger.log(`Updated user ${user.id} email from Apple notification`);
  }
}
