import { IsIn, IsOptional, IsString } from 'class-validator';

export class EstimateTaskDto {
  @IsString()
  taskType!: string;

  @IsOptional()
  @IsString()
  userSegment?: string;

  @IsOptional()
  @IsIn(['AUTO', 'PREMIUM'])
  modelMode?: 'AUTO' | 'PREMIUM';

  @IsOptional()
  @IsString()
  premiumModelId?: string;
}
