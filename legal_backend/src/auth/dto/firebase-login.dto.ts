import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';
import { USER_TYPES } from '../constants';

export class FirebaseLoginDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn([USER_TYPES.CONSUMER, USER_TYPES.LAWYER])
  userType?: string;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  firmName?: string;
}
