import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { AuthService } from './auth.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { AppleNotificationsService } from './apple-notifications.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SamlLoginDto } from './dto/saml-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailLookupDto } from './dto/email-lookup.dto';
import { ScimBearerGuard } from './scim-bearer.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly appleNotificationsService: AppleNotificationsService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('email-lookup')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  emailLookup(@Body() dto: EmailLookupDto) {
    return this.authService.lookupEmail(dto.email);
  }

  @Public()
  @Post('firebase/login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.firebaseAuthService.loginWithFirebase(dto);
  }

  /** Apple Sign In server-to-server notifications (Services ID configuration). */
  @Public()
  @Post('apple/notifications')
  @HttpCode(200)
  appleNotifications(@Body('payload') payload: string) {
    return this.appleNotificationsService
      .handleNotification(payload)
      .then(() => ({ received: true }));
  }

  @Public()
  @Post('saml/login')
  samlLogin(@Body() dto: SamlLoginDto) {
    return this.authService.samlLogin(dto);
  }

  /** IdP POSTs here without a bearer token; trust comes from SAML signature validation. */
  @Public()
  @Post('saml/acs')
  samlAcs(@Body() dto: SamlLoginDto) {
    return this.authService.samlAcs(dto);
  }

  @Public()
  @UseGuards(ScimBearerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('scim/v2/:tenantId/Users')
  scimProvision(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      userName: string;
      name?: { givenName?: string; familyName?: string };
      active?: boolean;
    },
  ) {
    return this.authService.scimProvisionUser(tenantId, body);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
