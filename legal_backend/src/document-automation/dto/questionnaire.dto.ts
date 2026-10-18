import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateQuestionnaireDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsArray()
  questions!: unknown[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateQuestionnaireDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsArray()
  questions?: unknown[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
