import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { USER_TYPES } from './constants';

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
        'Firebase authentication is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      );
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth(this.firebaseApp).verifyIdToken(dto.idToken);
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }

    const email = decoded.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Firebase token must include an email');
    }

    const displayName = dto.name ?? decoded.name ?? null;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ firebaseUid: decoded.uid }, { email }],
      },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: decoded.uid,
          name: user.name ?? displayName,
        },
      });
    } else {
      await this.authService.provisionFirebaseUser({
        email,
        firebaseUid: decoded.uid,
        name: displayName,
        userType: dto.userType ?? USER_TYPES.CONSUMER,
        countryCode: dto.countryCode,
        jurisdiction: dto.jurisdiction,
        firmName: dto.firmName,
      });
    }

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [{ firebaseUid: decoded.uid }, { email }],
        },
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
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
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
