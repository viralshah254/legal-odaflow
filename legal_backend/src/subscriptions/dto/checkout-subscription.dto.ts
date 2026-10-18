import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CheckoutSubscriptionDto {
  @IsString()
  planId!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  userType?: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;

  /** Page path to return to after Stripe checkout completes (e.g. /app/us-drafting/draft?kind=...) */
  @IsOptional()
  @IsString()
  returnPath?: string;

  /**
   * Billing interval for new subscriptions.
   * 'annual' uses a yearly price with a 20% discount (billed once per year).
   * Defaults to 'monthly' when omitted.
   */
  @IsOptional()
  @IsEnum(['monthly', 'annual'])
  billingCycle?: 'monthly' | 'annual';
}
