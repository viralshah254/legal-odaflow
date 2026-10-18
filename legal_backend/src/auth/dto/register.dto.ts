import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';
import { IsPasswordPolicy } from '../password-policy';
import { USER_TYPES } from '../constants';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsPasswordPolicy()
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn([USER_TYPES.CONSUMER, USER_TYPES.LAWYER])
  userType!: string;

  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @ValidateIf((dto: RegisterDto) => dto.userType === USER_TYPES.LAWYER)
  @IsString()
  @MinLength(2)
  firmName?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}
