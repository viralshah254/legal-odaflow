import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const MANUAL_CITATION_REVIEW_DECISIONS = [
  'APPROVE',
  'REJECT',
  'REPLACE',
] as const;

export type ManualCitationReviewDecision =
  (typeof MANUAL_CITATION_REVIEW_DECISIONS)[number];

export class ManualCitationReviewDecisionDto {
  @IsIn(MANUAL_CITATION_REVIEW_DECISIONS)
  decision!: ManualCitationReviewDecision;

  @IsString()
  @MinLength(2)
  reviewerNote!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sourceDocumentReference?: string;

  @ValidateIf((dto: ManualCitationReviewDecisionDto) => dto.decision !== 'REJECT')
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'sourceHash must be a 64-character SHA-256 digest',
  })
  sourceHash?: string;

  @ValidateIf((dto: ManualCitationReviewDecisionDto) => dto.decision !== 'REJECT')
  @IsString()
  @MinLength(12)
  exactPassage?: string;

  @ValidateIf((dto: ManualCitationReviewDecisionDto) => dto.decision !== 'REJECT')
  @IsString()
  @MinLength(1)
  pinpoint?: string;

  @ValidateIf((dto: ManualCitationReviewDecisionDto) => dto.decision !== 'REJECT')
  @IsIn(['PASSAGE', 'IDENTITY_ONLY'])
  evidenceKind?: 'PASSAGE' | 'IDENTITY_ONLY';

  @ValidateIf((dto: ManualCitationReviewDecisionDto) => dto.decision === 'REPLACE')
  @IsString()
  @MinLength(3)
  replacementCitation?: string;
}
