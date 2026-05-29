import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadPortalRequestDocumentDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
