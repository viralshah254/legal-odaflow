import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateConsumerCaseDto {
  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  facts?: string;

  @IsOptional()
  @IsString()
  desiredOutcome?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  urgencyLevel?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsNumber()
  riskScore?: number;
}
