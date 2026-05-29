import { IsOptional, IsString } from 'class-validator';

export class CheckoutSubscriptionDto {
  @IsString()
  planId!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  userType?: string;
}
