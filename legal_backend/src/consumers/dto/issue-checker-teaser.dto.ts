import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ISSUE_CHECKER_MODES } from '../issue-checker.constants';
import { IssueCheckerAnonymousFields } from './issue-checker-anonymous.dto';

export class IssueCheckerTeaserDto extends IssueCheckerAnonymousFields {
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

  @IsString()
  @MinLength(10)
  facts!: string;

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
  @IsObject()
  planningAnswers?: Record<string, string | string[]>;
}
