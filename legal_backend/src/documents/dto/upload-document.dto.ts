import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadDocumentMetadataDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  folderId?: string;
}

export class UploadConsumerDocumentDto {
  @IsString()
  @MinLength(1)
  consumerCaseId!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  documentType?: string;

  @IsOptional()
  fileSizeBytes?: number;
}

export class CreateUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  scope?: string;
}

export class CreateConsumerUploadUrlDto {
  @IsString()
  @MinLength(1)
  consumerCaseId!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class UploadConsumerFileDto {
  @IsString()
  @MinLength(1)
  consumerCaseId!: string;

  @IsOptional()
  @IsString()
  documentType?: string;
}
