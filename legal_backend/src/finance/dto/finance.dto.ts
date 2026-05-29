import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  status?: string;

  expenseDate!: Date;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  expenseDate?: Date;
}

export class CreateClaimDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  submitterId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateClaimDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateFixedCostDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFixedCostDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RecordInvoicePaymentDto {
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class UpdatePaymentReconciliationDto {
  @IsBoolean()
  reconciled!: boolean;
}
