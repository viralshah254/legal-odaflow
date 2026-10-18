import { IsIn, IsOptional, IsString } from 'class-validator';

export const MATTER_ACCESS_LEVELS = [
  'READ_ONLY',
  'READ',
  'WRITE',
  'FULL',
  'FULL_CASE_SUPPORT',
  'OWNER',
] as const;

export class GrantMatterAccessDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsIn(MATTER_ACCESS_LEVELS)
  accessLevel?: string;

  @IsOptional()
  @IsString()
  grantedBy?: string;
}

export class RevokeMatterAccessDto {
  @IsString()
  userId!: string;
}

export class UpdateMatterAccessDto {
  @IsIn(MATTER_ACCESS_LEVELS)
  accessLevel!: string;
}
