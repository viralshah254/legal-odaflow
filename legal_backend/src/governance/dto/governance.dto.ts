import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateDocumentPolicyDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  retentionDays?: number;

  @IsOptional()
  @IsString()
  defaultVisibility?: string;

  @IsOptional()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAccessPolicyDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFirmProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}

export class UpdateGovernancePoliciesDto {
  @IsOptional()
  documentPolicies?: UpdateDocumentPolicyDto[];

  @IsOptional()
  accessPolicies?: UpdateAccessPolicyDto[];

  @IsOptional()
  firmProfile?: UpdateFirmProfileDto;
}

export class CreateDocumentPolicyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  retentionDays?: number;

  @IsOptional()
  @IsString()
  defaultVisibility?: string;

  @IsOptional()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAccessPolicyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
