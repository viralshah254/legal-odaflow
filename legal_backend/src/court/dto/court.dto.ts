import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCourtCaseDto {
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  cnrNumber?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateCourtCaseDto {
  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  cnrNumber?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateCourtHearingDto {
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  hearingType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateCourtFilingDto {
  @IsString()
  @MinLength(1)
  filingType!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsDateString()
  filedAt?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateDocketEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}

export class EcourtsLookupDto {
  @IsString()
  @MinLength(1)
  cnrNumber!: string;
}

export class UsDocketSyncDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  courtCaseId?: string;
}
