import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const RESEARCH_TEASER_COUNTRIES = ['IN', 'US'] as const;

export class LegalResearchTeaserDto {
  @IsString()
  @MinLength(10)
  query!: string;

  @IsString()
  @IsIn(RESEARCH_TEASER_COUNTRIES)
  countryCode!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
