import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaskParticipantDto {
  @IsIn(['USER', 'CLIENT'])
  participantType!: 'USER' | 'CLIENT';

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsIn(['ASSIGNEE', 'COLLABORATOR', 'WATCHER', 'CLIENT'])
  role!: 'ASSIGNEE' | 'COLLABORATOR' | 'WATCHER' | 'CLIENT';
}

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @IsOptional()
  dueDate?: Date;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskParticipantDto)
  participants?: TaskParticipantDto[];
}
