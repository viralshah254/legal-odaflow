import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnsureResearchOutputDto {
  @IsString()
  @MaxLength(20_000)
  query: string;

  @IsString()
  @MaxLength(200_000)
  answer: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  aiOutputId?: string;
}
