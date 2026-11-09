import { Equals, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class FirmKnowledgeSubmissionDto {
  @IsIn(['approved_redline', 'strategy_memo', 'meeting_notes', 'custom']) sourceType!: string;
  @IsString() @MinLength(1) @MaxLength(200) sourceId!: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsString() @MinLength(1) @MaxLength(100000) content!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) matterId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) documentId?: string;
  @IsIn(['FIRM_WORK_PRODUCT', 'LICENSED_INTERNAL_USE', 'PUBLIC_DOMAIN']) rightsBasis!: string;
  @IsBoolean() @Equals(true) rightsConfirmed!: boolean;
  @IsOptional() @IsISO8601({ strict: true }) rightsExpiresAt?: string;
}

export class FirmKnowledgeReviewDto {
  @IsInt() @Min(1) expectedRevision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedContentHash!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsBoolean() selfReviewConfirmed?: boolean;
  @IsOptional() @IsBoolean() firmWideConfirmed?: boolean;
}
