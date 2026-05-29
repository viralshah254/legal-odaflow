import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateKycChecklistDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateKycChecklistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateKycDocumentDto {
  @IsOptional()
  @IsString()
  checklistId?: string;

  @IsString()
  @MinLength(1)
  documentType!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateKycDocumentDto {
  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class InitializeKycClientDto {
  @IsOptional()
  @IsString()
  clientType?: string;
}

export class UpdateKycDocumentByTypeDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
