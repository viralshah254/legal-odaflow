import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IsPasswordPolicy } from '@/auth/password-policy';

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['FIRM_ADMIN', 'PARTNER', 'ASSOCIATE', 'FINANCE', 'INTAKE', 'PARALEGAL', 'BILLING', 'STAFF'])
  role!: string;

  /** Temporary password — optional when using invitation flow. */
  @IsOptional()
  @IsPasswordPolicy()
  password?: string;

  /** Force the new user to change their password on first login. */
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  /**
   * Monthly AI credit limit for this user.
   * null / omitted = unlimited (bounded only by tenant wallet).
   * 0 = no AI access.
   * >0 = monthly cap in credits.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyCreditLimit?: number | null;

  /** Whether this user counts as a billable seat. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  isBillableSeat?: boolean;
}
