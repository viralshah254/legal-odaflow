import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['INDIVIDUAL', 'COMPANY', 'NGO', 'PARTNERSHIP'])
  type?: string;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: string;
}

