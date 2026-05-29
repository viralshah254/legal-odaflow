import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateLawyerProfileDto {
  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  barNumber?: string;

  @IsArray()
  practiceAreas!: string[];

  @IsArray()
  jurisdictions!: string[];

  @IsArray()
  languages!: string[];

  @IsString()
  currency!: string;

  @IsOptional()
  @IsNumber()
  consultationFee?: number;

  @IsOptional()
  @IsBoolean()
  acceptsLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  verificationStatus?: string;
}

export class CreateReviewRequestDto {
  @IsString()
  consumerCaseId!: string;

  @IsOptional()
  @IsString()
  consumerReportId?: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsString()
  issueType!: string;

  @IsNumber()
  price!: number;

  @IsString()
  currency!: string;
}

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  issueType!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  consumerCaseId?: string;
}
