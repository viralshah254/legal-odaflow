import { IsString, MinLength } from 'class-validator';

export class ConfirmAutoTopUpDto {
  @IsString()
  @MinLength(1)
  paymentMethodId!: string;
}
