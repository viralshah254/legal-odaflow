import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueCheckerAnonymousFields {
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceFingerprint?: string;
}
