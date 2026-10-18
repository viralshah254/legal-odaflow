import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateMonitorDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  jurisdiction: string;

  @IsArray()
  @IsString({ each: true })
  topics: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY'])
  frequency?: string;
}

export class UpdateMonitorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY'])
  frequency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMonitorHitDto {
  @IsIn(['NEW', 'READ', 'DISMISSED', 'SAVED'])
  status: string;
}
