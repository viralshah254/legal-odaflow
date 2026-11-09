import { IsInt, Min, Max, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  reminderMinutes?: number | null;

  @IsOptional()
  @IsString()
  matterId?: string | null;

  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CALENDAR_EVENT_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;
}
