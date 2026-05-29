import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTrainingDatasetDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  datasetType!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  sourcePolicy?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateTrainingDatasetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sourcePolicy?: string;
}

export class CreateTrainingDatasetItemDto {
  @IsString()
  @MinLength(1)
  datasetId!: string;

  @IsString()
  @MinLength(1)
  sourceType!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsString()
  @MinLength(1)
  inputText!: string;

  @IsOptional()
  @IsString()
  expectedOutput?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  consentId?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;
}

export class UpdateTrainingDatasetItemDto {
  @IsOptional()
  @IsString()
  expectedOutput?: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsBoolean()
  revoked?: boolean;
}
