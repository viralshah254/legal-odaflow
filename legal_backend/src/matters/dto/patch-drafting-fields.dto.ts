import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class PatchDraftingFieldsDto {
  @IsObject()
  fields!: Record<string, string | string[]>;

  @IsOptional()
  @IsBoolean()
  regenerateDraft?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedClauses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];
}

export class GenerateDraftingDocumentDto {
  @IsOptional()
  sectionHint?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedClauses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];
}
