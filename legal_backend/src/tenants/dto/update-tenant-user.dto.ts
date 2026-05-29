import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTenantUserDto {
  @IsOptional()
  @IsIn(['FIRM_ADMIN', 'PARTNER', 'ASSOCIATE', 'PARALEGAL', 'BILLING', 'STAFF'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INVITED', 'SUSPENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
