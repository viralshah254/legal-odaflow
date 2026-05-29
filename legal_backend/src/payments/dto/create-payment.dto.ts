import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  countryCode!: string;

  @IsString()
  purpose!: string;

  @IsOptional()
  metadata?: Record<string, string>;
}
