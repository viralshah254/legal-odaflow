import {
  IsOptional,
  IsString,
  MinLength,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import type { DraftProfile } from '../contracts/draft-execution-plan';
import type { QualityTier } from '../contracts/model-aliases';

export class CreateDraftJobDtoClass {
  @IsOptional()
  @IsIn(['india_court', 'matter_workspace', 'template_automation', 'legal_notice', 'contract', 'legal_opinion'])
  profile?: DraftProfile;

  @IsString()
  @IsNotEmpty()
  documentKind!: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  facts!: string;

  @IsOptional()
  @IsIn(['express', 'standard', 'premium'])
  qualityTier?: QualityTier;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  opposingParty?: string;

  @IsOptional()
  @IsString()
  attachmentContext?: string;

  @IsOptional()
  @IsString()
  formNumber?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
