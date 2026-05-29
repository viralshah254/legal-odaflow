import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ClioImportDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  rowCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5_000_000)
  csvContent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
