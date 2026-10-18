import { IsString, IsIn, IsOptional } from 'class-validator';

export class RegisterDeviceFingerprintDto {
  @IsString()
  fingerprint!: string;

  @IsIn(['signup', 'checkout', 'login'])
  source!: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
