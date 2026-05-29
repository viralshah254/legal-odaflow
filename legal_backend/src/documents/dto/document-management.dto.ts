import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDocumentFolderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  matterId?: string;
}

export class UpdateDocumentFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CreateDocumentVersionDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
