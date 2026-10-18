import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { PRACTICE_AREA_SLUGS } from '@/config/practice-areas';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class ProvisionLibraryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemTemplateIds?: string[];

  @IsOptional()
  @IsIn(PRACTICE_AREA_SLUGS)
  practiceArea?: string;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ListLibraryQueryDto {
  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: string;

  @IsOptional()
  @IsIn(PRACTICE_AREA_SLUGS)
  practiceArea?: string;

  @IsOptional()
  @IsBoolean()
  allPracticeAreas?: boolean;
}
