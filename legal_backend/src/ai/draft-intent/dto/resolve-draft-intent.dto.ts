import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Pasted case narratives + assignment instructions (law school / firm intake style). */
export const DRAFT_INTENT_QUERY_MAX_LENGTH = 12_000;

export class DraftContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(4)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  statute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  court?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  orderType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  documentIntent?: string;

  @IsOptional()
  @IsIn(['high', 'medium', 'low', 'none'])
  statuteConfidence?: 'high' | 'medium' | 'low' | 'none';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentKind?: string;

  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  documentKindConfidence?: 'high' | 'medium' | 'low';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentKindAlternatives?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  documentKindReason?: string;
}

export class ResolveDraftIntentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(DRAFT_INTENT_QUERY_MAX_LENGTH)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jurisdiction?: string;

  /** Answers to clarifying questions from the pre-analysis step. Keys are question IDs.
   *  Values are a single string for single-select or a string array for multi-select questions. */
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | string[]>;

  /** Context extracted by the free analyze step — avoids re-classifying long narratives. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DraftContextDto)
  context?: DraftContextDto;

  /** User-added context from recommended actions (merged into facts on resolve). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  supplementalContext?: string;

  /** Skip clarifying questions and still return provisional document suggestions. */
  @IsOptional()
  @IsBoolean()
  skipClarification?: boolean;

  /** Preferred output language for draft deep-links (e.g. en, hi). */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;
}

export class AnalyzeDraftIntentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(DRAFT_INTENT_QUERY_MAX_LENGTH)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  supplementalContext?: string;
}
