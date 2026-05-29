import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMatterDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  courtName?: string;

  @IsOptional()
  @IsString()
  courtLevel?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  practiceArea?: string;

  @IsOptional()
  @IsString()
  matterType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  factsSummary?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsString()
  opposingParty?: string;

  @IsOptional()
  @IsNumber()
  riskScore?: number;
}
