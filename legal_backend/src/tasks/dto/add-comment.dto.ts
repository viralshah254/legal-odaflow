import { IsString, MinLength } from 'class-validator';

export class AddTaskCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
