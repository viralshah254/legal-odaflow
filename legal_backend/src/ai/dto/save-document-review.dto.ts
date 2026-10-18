import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveDocumentReviewDto {
  @IsString()
  @MaxLength(500)
  fileName: string;

  @IsOptional()
  @IsIn(['CONTRACT', 'LEGAL_NOTICE', 'AGREEMENT', 'PETITION', 'MOU', 'AFFIDAVIT', 'WILL', 'GENERAL'])
  documentType?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsObject()
  reviewJson: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  extractedText?: string;
}
