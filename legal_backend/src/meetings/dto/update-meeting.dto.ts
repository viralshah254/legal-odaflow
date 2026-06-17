import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'recording', 'processing', 'ready', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'restricted', 'highly_restricted'])
  confidentiality?: string;

  @IsOptional()
  @IsInt()
  durationMin?: number;

  @IsOptional()
  @IsInt()
  durationMs?: number;

  @IsOptional()
  @IsString()
  audioStorageKey?: string;
}
