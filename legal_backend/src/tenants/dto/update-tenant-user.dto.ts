import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateTenantUserDto {
  @IsOptional()
  @IsIn(['FIRM_ADMIN', 'PARTNER', 'ASSOCIATE', 'PARALEGAL', 'BILLING', 'STAFF', 'FINANCE', 'INTAKE'])
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

  /**
   * Monthly AI credit limit.
   * null = remove limit (unlimited).
   * 0 = block AI access.
   * >0 = monthly cap.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyCreditLimit?: number | null;

  /**
   * When true, resets the user's credit cycle to now.
   * Historical ledger entries are preserved; the new cycle
   * start is max(calendarMonthStart, now()).
   */
  @IsOptional()
  @IsBoolean()
  resetCreditCycle?: boolean;

  /** Whether this user counts as a billable seat. */
  @IsOptional()
  @IsBoolean()
  isBillableSeat?: boolean;

  /** Seat billing lifecycle status. */
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXEMPT'])
  billingStatus?: string;
}
