import { IsIn, IsOptional, IsString } from 'class-validator';

export class PayInvoiceDto {
  @IsString()
  @IsIn(['card', 'bank_transfer', 'stripe', 'upi', 'google_pay', 'razorpay'])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  payToken?: string;
}
