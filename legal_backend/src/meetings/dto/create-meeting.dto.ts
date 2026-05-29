import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  scheduledAt?: Date;

  @IsOptional()
  @IsInt()
  durationMin?: number;
}
