import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  MATTER_STAGE_VALUES,
  MATTER_STATUS_VALUES,
  normalizeMatterStage,
  normalizeMatterStatus,
} from '../matter-lifecycle.constants';

export class UpdateMatterDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  leadAttorneyId?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  courtLevel?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsOptional()
  @IsString()
  matterType?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeMatterStatus(value) : value))
  @IsIn(MATTER_STATUS_VALUES)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeMatterStage(value) : value))
  @IsIn(MATTER_STAGE_VALUES)
  stage?: string;

  @IsOptional()
  @IsString()
  factsSummary?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsString()
  opposingParty?: string;

  @IsOptional()
  @IsNumber()
  riskScore?: number;
}
