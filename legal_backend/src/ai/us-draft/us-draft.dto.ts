import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { US_FEDERAL_DRAFT_KINDS } from './us-draft-prompts-federal';
import { US_STATE_BASE_DRAFT_KINDS } from './us-draft-prompts-state';
import { US_STATE_NAMED_DRAFT_KINDS } from './us-draft-prompts-state-named';
import { US_STATE_CODES } from '@/config/state-overlays';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';

const ALL_US_KINDS = [
  ...US_FEDERAL_DRAFT_KINDS,
  ...US_STATE_BASE_DRAFT_KINDS,
  ...US_STATE_NAMED_DRAFT_KINDS,
];

export class GenerateUsDraftDto {
  @IsString()
  @MinLength(1)
  kind!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  caseDetails!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  courtName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  opposingParty?: string;

  @IsString()
  @IsOptional()
  @IsIn(US_STATE_CODES)
  stateCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  formNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  formTitle?: string;

  @IsString()
  @IsOptional()
  @IsIn(['en'])
  language?: 'en';

  /**
   * Restrict retrieval to selected knowledge sources (statutes, case_law, firm_vault, web, etc.).
   * When omitted all enabled sources are queried.
   */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  knowledgeSources?: string[];
}

export class EnrichUsDraftDto {
  @IsString()
  @MinLength(1)
  draftText!: string;

  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsString()
  @IsOptional()
  @MaxLength(8000)
  rawFacts?: string;

  @IsString()
  @IsOptional()
  @IsIn(['case_laws', 'sections', 'both'])
  mode?: 'case_laws' | 'sections' | 'both';

  @IsString()
  @IsOptional()
  @IsIn(US_STATE_CODES)
  stateCode?: string;
}

export class FillUsBlanksDto {
  @IsString()
  @MinLength(1)
  documentKind!: string;

  @IsOptional()
  context?: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  emptyFields!: string[];

  @IsString()
  @IsOptional()
  @IsIn(US_STATE_CODES)
  stateCode?: string;
}

export const US_DRAFT_KINDS = ALL_US_KINDS;

export interface GenerateUsDraftResult {
  draft: string;
  creditsUsed: number;
  verification?: DraftVerificationAudit;
}
