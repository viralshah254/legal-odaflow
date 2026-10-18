import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserSeatPlanDto {
  @IsIn(['STARTER', 'PROFESSIONAL', 'PRO_PLUS'])
  planId!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
