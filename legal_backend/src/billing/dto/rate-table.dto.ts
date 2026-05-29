import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRateTableDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsObject()
  rates!: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  rates?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
