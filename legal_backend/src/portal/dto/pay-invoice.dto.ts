import { IsIn, IsOptional, IsString } from 'class-validator';

export class PayInvoiceDto {
  @IsString()
  @IsIn(['card', 'bank_transfer', 'razorpay', 'stripe'])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
