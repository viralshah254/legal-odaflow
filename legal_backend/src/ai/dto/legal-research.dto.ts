import { IsOptional, IsString, MinLength } from 'class-validator';

export class LegalResearchDto {
  @IsString()
  @MinLength(3)
  query!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;
}
