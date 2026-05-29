import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  billingPlan?: string;

  @IsOptional()
  @IsString()
  dataRegion?: string;

  @IsOptional()
  @IsObject()
  ssoConfig?: Record<string, unknown>;
}
