import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePublicBookingDto {
  @IsString()
  lawyerId!: string;

  @IsString()
  slot!: string;

  @IsString()
  @MinLength(2)
  clientName!: string;

  @IsEmail()
  clientEmail!: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsString()
  @MinLength(2)
  issueType!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
