import { IsArray, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ISSUE_CHECKER_MODES } from '../issue-checker.constants';

export class IssueCheckerPreviewDto {
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsString()
  @MinLength(2)
  issueType!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  facts?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsString()
  parties?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  urgencyLevel?: string;

  @IsOptional()
  @IsString()
  consumerCaseId?: string;

  @IsOptional()
  @IsIn(ISSUE_CHECKER_MODES)
  mode?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsIn(['INDIVIDUAL', 'COMPANY', 'NGO', 'PARTNERSHIP'])
  clientType?: string;

  @IsOptional()
  @IsString()
  clientReference?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  anonymousSessionId?: string;

  @IsOptional()
  @IsObject()
  planningAnswers?: Record<string, string | string[]>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedOutcomes?: string[];
}
