import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DocumentReviewDto {
  /** Existing document ID already stored in the platform (OCR text fetched server-side). */
  @IsOptional()
  @IsString()
  documentId?: string;

  /** Raw text content pasted by the user or pre-extracted by the client. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  extractedText?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsIn(['CONTRACT', 'LEGAL_NOTICE', 'AGREEMENT', 'PETITION', 'MOU', 'AFFIDAVIT', 'WILL', 'GENERAL'])
  documentType?: 'CONTRACT' | 'LEGAL_NOTICE' | 'AGREEMENT' | 'PETITION' | 'MOU' | 'AFFIDAVIT' | 'WILL' | 'GENERAL';

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsIn(['AUTO', 'PREMIUM'])
  aiModelMode?: 'AUTO' | 'PREMIUM';

  @IsOptional()
  @IsString()
  premiumModelId?: string;

  /** Output language for AI review output. 'en' = English (default), 'hi' = Hindi, 'hinglish' = mixed. */
  @IsOptional()
  @IsIn(['en', 'hi', 'hinglish'])
  outputLanguage?: 'en' | 'hi' | 'hinglish';
}
