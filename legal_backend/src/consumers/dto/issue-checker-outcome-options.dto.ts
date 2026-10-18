import { IsOptional, IsString, MinLength } from 'class-validator';
import { IssueCheckerAnonymousFields } from './issue-checker-anonymous.dto';

export class IssueCheckerOutcomeOptionsDto extends IssueCheckerAnonymousFields {
  @IsString()
  @MinLength(10)
  facts: string;

  @IsString()
  @MinLength(2)
  countryCode: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;
}
