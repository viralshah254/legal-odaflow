import { IsString, MinLength } from 'class-validator';

export class StartTimerDto {
  @IsString()
  @MinLength(1)
  matterId!: string;
}
