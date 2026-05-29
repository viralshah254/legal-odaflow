import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTimeEntryDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  date!: string;

  @IsInt()
  @Min(1)
  minutes!: number;

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
