import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly firebaseAuthService: FirebaseAuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('firebase/login')
  firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.firebaseAuthService.loginWithFirebase(dto);
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
}
