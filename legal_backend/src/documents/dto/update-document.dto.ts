import { IsIn, IsOptional, IsString } from 'class-validator';

export const DOCUMENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export class UpdateDocumentMetadataDto {
  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  matterId?: string | null;

  @IsOptional()
  @IsString()
  folderId?: string | null;

  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: (typeof DOCUMENT_STATUSES)[number];
}
