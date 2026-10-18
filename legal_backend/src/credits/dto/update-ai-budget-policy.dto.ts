import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAiBudgetPolicyDto {
  /** Monthly spend cap in USD. Set to 0 to remove the cap. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyBudgetUsd?: number;

  /** Percentage of monthly budget at which a warning is emitted (1-100). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertAtPercent?: number;

  /**
   * Whether to hard-stop AI requests when the monthly budget is exceeded.
   * When false (default), spending above the budget emits a warning but does not block.
   */
  @IsOptional()
  @IsBoolean()
  hardStopEnabled?: boolean;
}
