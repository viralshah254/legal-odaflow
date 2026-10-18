import { IsArray, IsOptional, IsString } from 'class-validator';

export class RunLeadAnalysisDto {
  @IsOptional()
  @IsString()
  additionalContext?: string;

  @IsOptional()
  @IsString()
  focusPrompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];

  @IsOptional()
  @IsString()
  premiumModelId?: string;
}

export class UpdateLeadContextDto {
  @IsOptional()
  @IsString()
  lawyerContextMarkdown?: string;
}

export class CreateLeadDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  fileSizeBytes?: number;
}
