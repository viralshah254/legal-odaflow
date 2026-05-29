import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMeetingNoteDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  createdById?: string;
}
