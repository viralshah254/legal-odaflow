import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserPreferencesDto)
  preferences?: UpdateUserPreferencesDto;
}
