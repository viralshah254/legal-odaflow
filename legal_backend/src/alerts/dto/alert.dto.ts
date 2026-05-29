import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAlertDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateAlertActionDto {
  @IsString()
  @MinLength(1)
  action!: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
