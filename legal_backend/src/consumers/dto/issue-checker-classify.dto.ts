import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';
import { ISSUE_CHECKER_MODES } from '../issue-checker.constants';

export class IssueCheckerClassifyDto {
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsString()
  @MinLength(10)
  facts!: string;

  @IsOptional()
  @IsIn(ISSUE_CHECKER_MODES)
  mode?: string;
}
