import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResearchEnrichDto {
  @IsIn(['case_laws', 'sections', 'both'])
  mode: 'case_laws' | 'sections' | 'both';

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;
}
