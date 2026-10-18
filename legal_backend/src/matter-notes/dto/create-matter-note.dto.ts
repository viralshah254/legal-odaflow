import { IsString, MinLength } from 'class-validator';

export class CreateMatterNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
