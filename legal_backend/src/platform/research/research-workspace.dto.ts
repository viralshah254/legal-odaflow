import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const RESEARCH_MODES = ['quick', 'deep', 'matter_aware', 'update'] as const;
const RESEARCH_STATUSES = [
  'pending',
  'planning',
  'retrieving',
  'synthesizing',
  'verifying',
  'completed',
  'failed',
] as const;

export class CreateResearchWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  objective!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsIn(RESEARCH_MODES)
  mode?: (typeof RESEARCH_MODES)[number];
}

export class ResearchRevisionInputDto {
  @IsString()
  aiOutputId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  affectedIssueIds?: string[];

  @IsOptional()
  @IsObject()
  provenance?: Record<string, unknown>;
}

export class UpdateResearchWorkspaceDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsIn(RESEARCH_MODES)
  mode?: (typeof RESEARCH_MODES)[number];

  @IsOptional()
  @IsIn(RESEARCH_STATUSES)
  status?: (typeof RESEARCH_STATUSES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResearchRevisionInputDto)
  revision?: ResearchRevisionInputDto;
}

export class ResearchContextProvenanceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sourceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUri?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AppendResearchContextDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsObject()
  content!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => ResearchContextProvenanceDto)
  provenance!: ResearchContextProvenanceDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  affectedIssueIds?: string[];
}
