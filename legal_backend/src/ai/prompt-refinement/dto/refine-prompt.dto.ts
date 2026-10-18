import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Max prompt length accepted from the client (matches research textarea paste size). */
export const PROMPT_REFINE_REQUEST_MAX_LENGTH = 16_000;

/** Max characters sent to the refinement LLM (cost/latency guard). */
export const PROMPT_REFINE_LLM_INPUT_MAX_LENGTH = 6_000;

/** Max length for refined prompt returned to the client. */
export const PROMPT_REFINE_OUTPUT_MAX_LENGTH = 8_000;

/** @deprecated Use PROMPT_REFINE_REQUEST_MAX_LENGTH */
export const PROMPT_REFINE_MAX_LENGTH = PROMPT_REFINE_REQUEST_MAX_LENGTH;

export class RefinePromptDto {
  @IsString()
  @MinLength(3)
  @MaxLength(PROMPT_REFINE_REQUEST_MAX_LENGTH)
  prompt!: string;

  @IsIn(['research', 'drafting'])
  purpose!: 'research' | 'drafting';

  @IsOptional()
  @IsString()
  @MaxLength(4)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  practiceArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  outputLanguage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];
}
