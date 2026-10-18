import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const CALENDAR_EVENT_TYPES = [
  'MEETING',
  'HEARING',
  'DEADLINE',
  'APPOINTMENT',
  'OTHER',
  'Meeting',
  'Hearing',
  'Deadline',
  'Appointment',
  'Other',
  'COURT_DATE',
  'TASK_DEADLINE',
] as const;

export class CreateCalendarEventDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CALENDAR_EVENT_TYPES)
  type?: string;

  @IsString()
  startAt!: string;

  @IsString()
  endAt!: string;
}
