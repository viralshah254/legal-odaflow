import { IsOptional, IsString } from 'class-validator';

export class EstimateAiTaskDto {
  @IsString()
  taskType!: string;

  @IsOptional()
  @IsString()
  userSegment?: string;
}
