import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class CreateMatterDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  courtLevel?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsString()
  practiceArea!: string;

  @IsString()
  matterType!: string;

  @IsOptional()
  @IsString()
  factsSummary?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsString()
  opposingParty?: string;
}

