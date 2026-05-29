import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAnonymizationJobDto {
  @IsString()
  @MinLength(1)
  sourceType!: string;

  @IsString()
  @MinLength(1)
  sourceId!: string;
}

export class UpdateAnonymizationJobDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  outputText?: string;

  @IsOptional()
  @IsString()
  error?: string;
}
