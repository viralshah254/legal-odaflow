import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ISSUE_CHECKER_MODES } from '../issue-checker.constants';
import { IssueCheckerAnonymousFields } from './issue-checker-anonymous.dto';

export class IssueCheckerPlanQuestionsDto extends IssueCheckerAnonymousFields {
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsString()
  @MinLength(10)
  facts!: string;

  @IsOptional()
  @IsIn(ISSUE_CHECKER_MODES)
  mode?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  /** Optional parties string from classify step — helps role inference. */
  @IsOptional()
  @IsString()
  parties?: string;
}
