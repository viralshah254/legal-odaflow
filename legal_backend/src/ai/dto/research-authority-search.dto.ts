import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ResearchAuthoritySearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2_000)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  limit?: number;
}
