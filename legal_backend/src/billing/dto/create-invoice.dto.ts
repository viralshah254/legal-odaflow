import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(2)
  invoiceNumber!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  dueDate?: Date;
}

export class CreateTrustAccountDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  currency!: string;
}

export class CreateTrustEntryDto {
  @IsString()
  type!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReviewTrustEntryDto {
  @IsOptional()
  @IsString()
  note?: string;
}
