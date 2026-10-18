import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDraftingSessionDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  systemTemplateId?: string;

  @IsOptional()
  @IsString()
  documentKind?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  sourceQuery?: string;
}

export class UpdateDraftingSessionFieldsDto {
  @IsObject()
  fieldValues!: Record<string, string | boolean>;

  @IsOptional()
  @IsObject()
  clauseAnswers?: Record<string, string | boolean>;
}

export class DraftingSessionExtractDto {
  @IsOptional()
  @IsString()
  text?: string;
}

export class DraftingSessionEditDto {
  @IsString()
  instruction!: string;

  @IsOptional()
  @IsString()
  selectedText?: string;

  @IsOptional()
  @IsString()
  context?: string;
}

export class DraftingSessionFinalizeDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: Array<'save' | 'sign' | 'review' | 'export_docx' | 'export_pdf'>;

  @IsOptional()
  @IsArray()
  signers?: Array<{ name: string; email: string; routingOrder?: number }>;

  @IsOptional()
  @IsString()
  reviewMessage?: string;
}

export class DraftingSessionExportDto {
  @IsString()
  format!: 'docx' | 'pdf';
}

export class DraftingSessionGenerateDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];
}
