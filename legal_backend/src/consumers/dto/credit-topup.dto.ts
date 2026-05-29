import { IsIn, IsString, Length } from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '@/config/countries';

export class CreditTopupCheckoutDto {
  @IsString()
  @Length(2, 2)
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode!: string;

  @IsString()
  packId!: string;
}
