import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { resolveFirebaseServiceAccount } from '@/common/utils/firebase-admin.util';

@Injectable()
export class FirebaseAuthService {
  private firebaseApp: admin.app.App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    this.initializeFirebase();
  }

  isConfigured(): boolean {
    return this.firebaseApp !== null;
  }

  async loginWithFirebase(dto: FirebaseLoginDto) {
    if (!this.firebaseApp) {
      throw new ServiceUnavailableException(
        'Firebase authentication is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      );
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth(this.firebaseApp).verifyIdToken(dto.idToken);
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }

    const email = decoded.email?.toLowerCase() ?? null;
    // A signed token proves the Firebase identity, not ownership of an unverified
    // email. Never link or provision a legal account from that claim.
    if (email && decoded.email_verified !== true) {
      throw new UnauthorizedException('Verify your email address before signing in.');
    }

    const displayName = dto.name ?? decoded.name ?? null;

    let user = await this.prisma.user.findFirst({
      where: email
        ? { OR: [{ firebaseUid: decoded.uid }, { email }] }
        : { firebaseUid: decoded.uid },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: decoded.uid,
          name: user.name ?? displayName,
          ...(dto.phone && !user.phone ? { phone: dto.phone.trim() } : {}),
        },
      });

      // Apply referral code for existing users who arrive via a referral link —
      // this fills the gap when the user already had an account and skipped /auth/sign-up.
      if (dto.referralCode) {
        await this.authService.applyReferralCodeIfMissing(
          user.id,
          dto.referralCode,
          dto.deviceFingerprint,
        );
      }
    } else {
      if (!email) {
        throw new UnauthorizedException(
          'Unable to sign in with Apple. Use the same Apple ID you signed up with, or contact support.',
        );
      }

      if (!dto.userType || !dto.countryCode) {
        throw new UnprocessableEntityException({
          code: 'PROFILE_COMPLETION_REQUIRED',
          message: 'Complete your profile to finish sign up',
          email,
          name: displayName,
        });
      }

      await this.authService.provisionFirebaseUser({
        email,
        firebaseUid: decoded.uid,
        name: displayName,
        userType: dto.userType,
        countryCode: dto.countryCode,
        jurisdiction: dto.jurisdiction,
        firmName: dto.firmName,
        phone: dto.phone?.trim(),
        referralCode: dto.referralCode,
        deviceFingerprint: dto.deviceFingerprint,
      });
    }

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: email
          ? { OR: [{ firebaseUid: decoded.uid }, { email }] }
          : { firebaseUid: decoded.uid },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Failed to provision Firebase user');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return this.authService.issueTokensForUser(user.id);
  }

  private initializeFirebase(): void {
    const config = resolveFirebaseServiceAccount({
      FIREBASE_SERVICE_ACCOUNT_PATH: this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
      ),
      FIREBASE_PROJECT_ID: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      FIREBASE_CLIENT_EMAIL: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      FIREBASE_PRIVATE_KEY: this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
    });

    if (!config) {
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(config),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('already exists')
      ) {
        this.firebaseApp = admin.app();
        return;
      }
      throw error;
    }
  }
}
