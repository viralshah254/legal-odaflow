import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCalendarEventDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  startAt!: string;

  @IsString()
  endAt!: string;
}
