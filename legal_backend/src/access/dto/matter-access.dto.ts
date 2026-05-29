import { IsOptional, IsString } from 'class-validator';

export class GrantMatterAccessDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  accessLevel?: string;

  @IsOptional()
  @IsString()
  grantedBy?: string;
}

export class RevokeMatterAccessDto {
  @IsString()
  userId!: string;
}
