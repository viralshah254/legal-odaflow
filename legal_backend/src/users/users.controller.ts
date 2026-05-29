import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SkipTenant } from '@/common/decorators/skip-tenant.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UsersService } from './users.service';

@Controller('users')
@SkipTenant()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get('me/preferences')
  getPreferences(@CurrentUser() user: RequestUser) {
    return this.usersService.getPreferences(user.id);
  }

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.id, dto);
  }
}
