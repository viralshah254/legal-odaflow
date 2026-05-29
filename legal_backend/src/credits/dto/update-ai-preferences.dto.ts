import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAiPreferencesDto {
  @IsOptional()
  @IsIn(['AUTO', 'PREMIUM'])
  aiModelMode?: 'AUTO' | 'PREMIUM';

  @IsOptional()
  @IsString()
  premiumModelId?: string;

  @IsOptional()
  @IsBoolean()
  autoTopUpEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  autoTopUpThresholdCredits?: number;

  @IsOptional()
  @IsString()
  autoTopUpPackId?: string;
}
