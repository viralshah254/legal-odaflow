import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

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
}
