import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTrainingConsentDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  @MinLength(1)
  scope!: string;

  @IsOptional()
  @IsString()
  consentStatus?: string;

  @IsOptional()
  @IsString()
  consentTextVersion?: string;

  @IsString()
  @MinLength(2)
  jurisdictionCountryCode!: string;

  @IsOptional()
  @IsBoolean()
  canUseForPromptImprove?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseForEvaluation?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseForFineTuning?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAnonymization?: boolean;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class UpdateTrainingConsentDto {
  @IsOptional()
  @IsString()
  consentStatus?: string;

  @IsOptional()
  @IsBoolean()
  canUseForPromptImprove?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseForEvaluation?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseForFineTuning?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAnonymization?: boolean;
}
