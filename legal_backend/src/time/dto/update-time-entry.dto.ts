import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number;

  @IsOptional()
  @IsString()
  narrative?: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  rate?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  status?: string;
}
