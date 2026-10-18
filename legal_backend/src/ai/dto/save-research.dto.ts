import {
  Equals,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveResearchDto {
  @IsString()
  @MinLength(1)
  clientId: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  aiOutputId?: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(20_000)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsObject()
  researchJson: Record<string, unknown>;
}

export class PromoteSavedResearchDto {
  @Equals(true)
  confirmPromotion: true;

  @IsIn(['MARKDOWN_WITH_JSON_APPENDIX'])
  format: 'MARKDOWN_WITH_JSON_APPENDIX';
}
