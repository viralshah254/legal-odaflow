import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateOutcomeAnalysisDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  portalVisible?: boolean;

  @IsOptional()
  @IsString()
  portalSummary?: string;

  @IsOptional()
  @IsString()
  portalOutlookLabel?: string;
}
