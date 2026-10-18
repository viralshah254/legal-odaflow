import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInvoiceFromApprovedTimeDto {
  @IsString()
  @MinLength(1)
  matterId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
