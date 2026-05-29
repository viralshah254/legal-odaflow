import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAssistanceRequestDto {
  @IsString()
  @MinLength(1)
  subject!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateAssistanceRequestDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
