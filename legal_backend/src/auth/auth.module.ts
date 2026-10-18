import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ReferralsModule } from '@/referrals/referrals.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  assertAuthSecretsConfigured,
  resolveJwtSecret,
} from './auth-secrets.util';
import { FirebaseAuthService } from './firebase-auth.service';
import { AppleNotificationsService } from './apple-notifications.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordModule } from './password/password.module';
import { SamlService } from './saml.service';
import { ScimBearerGuard } from './scim-bearer.guard';

@Module({
  imports: [
    PasswordModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
    forwardRef(() => ReferralsModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseAuthService,
    AppleNotificationsService,
    JwtStrategy,
    SamlService,
    ScimBearerGuard,
  ],
  exports: [AuthService, FirebaseAuthService, JwtModule],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    assertAuthSecretsConfigured(this.configService);
  }
}
