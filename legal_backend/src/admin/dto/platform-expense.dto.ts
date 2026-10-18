export class CreatePlatformExpenseDto {
  category!: string;
  vendor?: string;
  description!: string;
  amount!: number;
  currency!: string;
  taxAmount?: number;
  expenseDate!: string;
  isRecurring?: boolean;
  receiptUrl?: string;
  snapshotRef?: string;
  metadata?: Record<string, unknown>;
}

export class UpdatePlatformExpenseDto {
  category?: string;
  vendor?: string;
  description?: string;
  amount?: number;
  currency?: string;
  taxAmount?: number;
  expenseDate?: string;
  isRecurring?: boolean;
  receiptUrl?: string;
  snapshotRef?: string;
  metadata?: Record<string, unknown>;
}
