import { IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class CreditTopupCheckoutDto {
  @IsString()
  @Length(2, 2)
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsOptional()
  @IsString()
  packId?: string;

  /** Custom USD amount (min $5). When provided, packId is ignored. */
  @IsOptional()
  @IsNumber()
  @Min(5)
  customAmountUsd?: number;

  /** Page path to return to after Stripe checkout completes (e.g. /app/us-drafting/draft?kind=...) */
  @IsOptional()
  @IsString()
  returnPath?: string;
}
