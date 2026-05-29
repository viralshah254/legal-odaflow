import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['FIRM_ADMIN', 'PARTNER', 'ASSOCIATE', 'FINANCE', 'INTAKE'])
  role!: string;
}
