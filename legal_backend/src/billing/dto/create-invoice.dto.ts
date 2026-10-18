import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MilestoneLineItemDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

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

  @IsOptional()
  @IsString()
  billingModel?: 'HOURLY' | 'FIXED' | 'CONTINGENCY' | 'MILESTONE' | 'SUBSCRIPTION';

  @IsOptional()
  @IsNumber()
  @Min(0)
  contingencyPercent?: number;

  @IsOptional()
  @IsString()
  contingencyTrigger?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneLineItemDto)
  lineItems?: MilestoneLineItemDto[];
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
