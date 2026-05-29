import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePlaybookDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  matterType?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsArray()
  taskTemplates!: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdatePlaybookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  matterType?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsOptional()
  @IsArray()
  taskTemplates?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
