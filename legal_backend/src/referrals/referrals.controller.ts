import { BadRequestException, Body, Controller, ForbiddenException, Get, Ip, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { ReferralsService } from './referrals.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { RegisterDeviceFingerprintDto } from './dto/register-device.dto';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Public()
  @Get('preview')
  previewReferral(@Query('code') code: string) {
    if (!code || !/^[A-Z0-9]{8}$/.test(code.toUpperCase())) {
      throw new BadRequestException('Invalid referral code format');
    }
    return this.referralsService.previewReferral(code.toUpperCase());
  }

  @Get('me')
  getMyReferrals(@CurrentUser() user: RequestUser) {
    return this.referralsService.getMyStats(user.id);
  }

  @Get('me/referee-status')
  getRefereeStatus(@CurrentUser() user: RequestUser) {
    return this.referralsService.getRefereeStatus(user.id);
  }

  @Post('apply')
  applyReferral(
    @CurrentUser() user: RequestUser,
    @Body() dto: ApplyReferralDto,
    @Ip() ip: string,
  ) {
    return this.referralsService.applyReferralCode({
      refereeUserId: user.id,
      code: dto.code,
      deviceFingerprint: dto.deviceFingerprint,
      ipAddress: ip,
    });
  }

  @Post('device')
  registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceFingerprintDto,
  ) {
    return this.referralsService.registerDeviceFingerprint(
      user.id,
      dto.fingerprint,
      dto.source,
    );
  }

  /** Retroactively attribute a referral. SUPER_ADMIN only. */
  @Post('admin/attribute')
  adminAttributeReferral(
    @CurrentUser() caller: RequestUser,
    @Body() dto: { refereeUserId: string; referralCode: string },
  ) {
    if (caller.userType !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    if (!dto.refereeUserId || !dto.referralCode) {
      throw new BadRequestException('refereeUserId and referralCode are required');
    }
    return this.referralsService.applyReferralCode({
      refereeUserId: dto.refereeUserId,
      code: dto.referralCode.toUpperCase(),
    });
  }
}
