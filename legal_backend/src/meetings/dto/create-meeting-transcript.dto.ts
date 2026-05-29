import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMeetingTranscriptDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  source?: string;
}
