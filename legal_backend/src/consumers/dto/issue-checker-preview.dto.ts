import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';
import { ISSUE_CHECKER_MODES } from '../issue-checker.constants';

export class IssueCheckerPreviewDto {
  @IsIn(SUPPORTED_COUNTRY_CODES)
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
  clientReference?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  anonymousSessionId?: string;
}
