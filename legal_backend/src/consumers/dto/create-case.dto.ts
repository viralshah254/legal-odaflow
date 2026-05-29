import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class CreateConsumerCaseDto {
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsString()
  @MinLength(2)
  issueType!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  facts?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  urgencyLevel?: string;
}
