import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMatterFactDto {
  @IsString()
  @MinLength(1)
  factText!: string;

  @IsString()
  @MinLength(1)
  sourceType!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  isDisputed?: boolean;

  @IsOptional()
  @IsBoolean()
  approvedByLawyer?: boolean;
}

export class UpdateMatterFactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  factText?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  isDisputed?: boolean;

  @IsOptional()
  @IsBoolean()
  approvedByLawyer?: boolean;
}

export class CreateMatterIssueDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class UpdateMatterIssueDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class CreateMatterArgumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  side?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  strength?: string;
}

export class UpdateMatterArgumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  side?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  strength?: string;
}

export class CreateMatterStrategyMemoDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateMatterStrategyMemoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
