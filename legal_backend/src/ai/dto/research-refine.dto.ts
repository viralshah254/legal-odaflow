import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ResearchTaskKind } from '../legal-research/research-planning.types';

export class ResearchRefineAuthorityDto {
  /**
   * Authority search results may be passed directly into addedAuthorities.
   * At least one of summary, fullText, or excerpt must contain evidence text;
   * title-only authorities are rejected by the refinement service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  authorityId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  citation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2_000)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40_000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80_000)
  fullText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40_000)
  excerpt?: string;

  @IsOptional()
  @IsIn(['primary', 'case_law', 'firm', 'web', 'seed'])
  sourceTier?: 'primary' | 'case_law' | 'firm' | 'web' | 'seed';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  authorityType?: string;
}

export class ResearchRefineDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(256, { each: true })
  pinnedAuthorityIds: string[];

  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(256, { each: true })
  excludedAuthorityIds: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ResearchRefineAuthorityDto)
  /** Evidence-backed authorities selected from authority search or supplied by the caller. */
  addedAuthorities: ResearchRefineAuthorityDto[];

  @IsString()
  @MaxLength(30_000)
  addedContext: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  jurisdiction?: string;

  @IsOptional()
  @IsIn(['ANSWER', 'AUTHORITY_LIST', 'ANALYSIS', 'MEMO', 'VERIFICATION'])
  desiredOutput?: 'ANSWER' | 'AUTHORITY_LIST' | 'ANALYSIS' | 'MEMO' | 'VERIFICATION';

  @IsOptional()
  @IsIn([
    'SECTION_LOOKUP',
    'STATUTORY_INTERPRETATION',
    'CASE_LOOKUP',
    'CASE_SURVEY',
    'CASE_ANALYSIS',
    'CASE_COMPARISON',
    'CITATION_VERIFICATION',
    'CURRENT_LAW',
    'ADVERSE_AUTHORITY',
    'PROCEDURE',
    'GENERAL_RESEARCH',
    'MATTER_OPINION',
  ])
  requestedTaskKind?: ResearchTaskKind;
}
