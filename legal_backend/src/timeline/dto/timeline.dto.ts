import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTimelineEventDto {
  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  occurredAt?: Date;
}

export class UpdateTimelineEventDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  occurredAt?: Date;
}
