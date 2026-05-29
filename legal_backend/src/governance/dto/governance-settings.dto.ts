import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateGovernanceSettingsDto {
  @IsOptional()
  @IsBoolean()
  ethicalWallsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  dataRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  aiTrainingOptOut?: boolean;

  @IsOptional()
  @IsBoolean()
  requireMatterApprovalForSharing?: boolean;

  @IsOptional()
  @IsString()
  copilotPolicy?: string;
}

export interface GovernanceSettings {
  ethicalWallsEnabled: boolean;
  dataRetentionDays: number;
  aiTrainingOptOut: boolean;
  requireMatterApprovalForSharing: boolean;
  copilotPolicy: string;
  updatedAt?: string;
}

export const DEFAULT_GOVERNANCE_SETTINGS: GovernanceSettings = {
  ethicalWallsEnabled: false,
  dataRetentionDays: 2555,
  aiTrainingOptOut: true,
  requireMatterApprovalForSharing: false,
  copilotPolicy: 'STANDARD',
};
