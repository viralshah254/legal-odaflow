import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Z0-9]{8}$/, { message: 'Invalid referral code format' })
  code!: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
