export interface CommercialRecoveryInvoiceCalculation {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  originalPrincipal: number;
  principalPaid: number;
  principalOutstanding: number;
  preSuitInterest: number;
}

export interface CommercialRecoveryCalculation {
  currency: 'INR';
  annualInterestRate: number;
  filingDate: string;
  allocationMethod: string;
  invoices: CommercialRecoveryInvoiceCalculation[];
  totalOriginalPrincipal: number;
  totalPayments: number;
  totalPrincipalOutstanding: number;
  totalPreSuitInterest: number;
  totalClaimAtFiling: number;
  issues: string[];
}

export interface CommercialRecoveryPaymentFact {
  id: string;
  date: string;
  amount: number;
  allocationMethod: string;
  source: 'client_instruction' | 'uploaded_document' | 'lawyer_confirmed';
}

/**
 * Immutable, generation-safe source of truth for a commercial recovery claim.
 * A lock may be incomplete; `blockingIssues` must be resolved before totals are
 * represented as filing-ready.
 */
export interface CommercialRecoveryFactLock {
  kind: 'commercial_recovery';
  version: 1;
  source: 'client_instruction' | 'lawyer_confirmed';
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    amount: number;
    dueDate?: string;
  }>;
  payments: CommercialRecoveryPaymentFact[];
  annualInterestRate?: number;
  creditDays?: number;
  interestType: 'simple' | 'compound' | 'unconfirmed';
  dayCountConvention: 'actual_365' | 'unconfirmed';
  filingDate?: string;
  deliveryBasis?: string;
  calculation?: CommercialRecoveryCalculation;
  blockingIssues: string[];
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseIndianDate(value: string): Date | undefined {
  const match = value
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return undefined;
  const month = MONTHS[match[2].toLowerCase()];
  if (month === undefined) return undefined;
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function interest(principal: number, annualRate: number, days: number): number {
  return Math.round((principal * annualRate * days) / (365 * 100) * 100) / 100;
}

function extractInvoices(
  text: string,
): Array<{ invoiceNumber: string; invoiceDate: Date; amount: number }> {
  const invoices: Array<{
    invoiceNumber: string;
    invoiceDate: Date;
    amount: number;
  }> = [];
  const pattern =
    /Invoice(?:\s+No\.?)?\s*([A-Z0-9/-]+)\s+dated\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*(?:for\s*)?(?:—|-|:)?\s*₹\s*([\d,]+(?:\.\d+)?)/gi;
  for (const match of text.matchAll(pattern)) {
    const invoiceDate = parseIndianDate(match[2]);
    if (!invoiceDate) continue;
    invoices.push({
      invoiceNumber: match[1],
      invoiceDate,
      amount: Number(match[3].replace(/,/g, '')),
    });
  }
  return invoices.sort(
    (a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime(),
  );
}

export function buildCommercialRecoveryFactLock(params: {
  facts: string;
  deliveryBasis?: string;
  allocationMethod?: string;
  confirmed?: boolean;
}): CommercialRecoveryFactLock {
  const invoices = extractInvoices(params.facts);
  const filingDate = extractFilingDate(params.facts);
  const rateMatch = params.facts.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:per\s+annum|p\.?a\.?)/i,
  );
  const creditDaysMatch = params.facts.match(
    /payment\s+(?:was\s+)?to\s+be\s+made\s+within\s+(\d+)\s+days/i,
  );
  const partPayment = extractPartPayment(params.facts);
  const blockingIssues: string[] = [];

  if (invoices.length === 0) blockingIssues.push('No invoice schedule could be extracted.');
  if (!filingDate) blockingIssues.push('Proposed filing date is not confirmed.');
  if (!rateMatch) blockingIssues.push('Contractual interest rate is not confirmed.');
  if (!creditDaysMatch) blockingIssues.push('Contractual credit period is not confirmed.');
  if (params.deliveryBasis !== 'invoice_dates') {
    blockingIssues.push(
      'Invoice dates cannot be treated as delivery dates unless that basis is confirmed.',
    );
  }
  if (
    partPayment &&
    !['oldest_invoice_first', 'oldest_invoice_principal_first'].includes(
      params.allocationMethod ?? '',
    )
  ) {
    blockingIssues.push('Part-payment appropriation method is not confirmed.');
  }

  const calculation = calculateCommercialRecoveryClaim(params);
  if (calculation?.issues.length) blockingIssues.push(...calculation.issues);

  return {
    kind: 'commercial_recovery',
    version: 1,
    source: params.confirmed ? 'lawyer_confirmed' : 'client_instruction',
    invoices: invoices.map((invoice, index) => ({
      id: `INVOICE_${index + 1}`,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: isoDate(invoice.invoiceDate),
      amount: invoice.amount,
      dueDate:
        creditDaysMatch && params.deliveryBasis === 'invoice_dates'
          ? isoDate(addDays(invoice.invoiceDate, Number(creditDaysMatch[1])))
          : undefined,
    })),
    payments: partPayment
      ? [
          {
            id: 'PAYMENT_1',
            date: isoDate(partPayment.date),
            amount: partPayment.amount,
            allocationMethod: params.allocationMethod ?? 'unconfirmed',
            source: params.confirmed ? 'lawyer_confirmed' : 'client_instruction',
          },
        ]
      : [],
    annualInterestRate: rateMatch ? Number(rateMatch[1]) : undefined,
    creditDays: creditDaysMatch ? Number(creditDaysMatch[1]) : undefined,
    interestType: 'simple',
    dayCountConvention: 'actual_365',
    filingDate: filingDate ? isoDate(filingDate) : undefined,
    deliveryBasis: params.deliveryBasis,
    calculation,
    blockingIssues: [...new Set(blockingIssues)],
  };
}

function extractPartPayment(
  text: string,
): { date: Date; amount: number } | undefined {
  const match = text.match(
    /\bOn\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})[\s\S]{0,80}?\bpaid\s+₹\s*([\d,]+(?:\.\d+)?)/i,
  );
  const reverseMatch = text.match(
    /\bpaid\s+₹\s*([\d,]+(?:\.\d+)?)[\s\S]{0,40}?\bon\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
  );
  if (!match && !reverseMatch) return undefined;
  const dateText = match?.[1] ?? reverseMatch?.[2];
  const amountText = match?.[2] ?? reverseMatch?.[1];
  if (!dateText || !amountText) return undefined;
  const date = parseIndianDate(dateText);
  if (!date) return undefined;
  return { date, amount: Number(amountText.replace(/,/g, '')) };
}

function extractFilingDate(text: string): Date | undefined {
  const match = text.match(
    /(?:institute|instituted|filing|file|proceedings)\b[\s\S]{0,60}?\b(?:on\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
  );
  return match ? parseIndianDate(match[1]) : undefined;
}

export function calculateCommercialRecoveryClaim(params: {
  facts: string;
  deliveryBasis?: string;
  allocationMethod?: string;
}): CommercialRecoveryCalculation | undefined {
  const invoices = extractInvoices(params.facts);
  const filingDate = extractFilingDate(params.facts);
  const rateMatch = params.facts.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:per\s+annum|p\.?a\.?)/i,
  );
  const creditDaysMatch = params.facts.match(
    /payment\s+(?:was\s+)?to\s+be\s+made\s+within\s+(\d+)\s+days/i,
  );
  if (
    invoices.length === 0 ||
    !filingDate ||
    !rateMatch ||
    !creditDaysMatch ||
    params.deliveryBasis !== 'invoice_dates'
  ) {
    return undefined;
  }

  const annualInterestRate = Number(rateMatch[1]);
  const creditDays = Number(creditDaysMatch[1]);
  const partPayment = extractPartPayment(params.facts);
  const allocationMethod = params.allocationMethod ?? 'unconfirmed';
  const calculableAllocation = [
    'oldest_invoice_first',
    'oldest_invoice_principal_first',
  ].includes(allocationMethod);
  const issues: string[] = [];
  if (partPayment && !calculableAllocation) {
    issues.push(
      'Part-payment allocation is not arithmetically determinable from the confirmed inputs.',
    );
  }

  let paymentRemaining =
    partPayment && calculableAllocation ? partPayment.amount : 0;
  const rows: CommercialRecoveryInvoiceCalculation[] = invoices.map((invoice) => {
    const dueDate = addDays(invoice.invoiceDate, creditDays);
    const interestStart = addDays(dueDate, 1);
    const paid =
      partPayment && partPayment.date >= interestStart
        ? Math.min(invoice.amount, paymentRemaining)
        : 0;
    paymentRemaining -= paid;
    const beforePaymentDays =
      partPayment && paid > 0
        ? daysBetween(interestStart, partPayment.date)
        : 0;
    const outstanding = invoice.amount - paid;
    const afterPaymentStart =
      partPayment && paid > 0 ? partPayment.date : interestStart;
    const afterPaymentDays = daysBetween(afterPaymentStart, filingDate);
    const preSuitInterest =
      interest(invoice.amount, annualInterestRate, beforePaymentDays) +
      interest(outstanding, annualInterestRate, afterPaymentDays);
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: isoDate(invoice.invoiceDate),
      dueDate: isoDate(dueDate),
      originalPrincipal: invoice.amount,
      principalPaid: paid,
      principalOutstanding: outstanding,
      preSuitInterest: Math.round(preSuitInterest * 100) / 100,
    };
  });

  const totalOriginalPrincipal = rows.reduce(
    (sum, row) => sum + row.originalPrincipal,
    0,
  );
  const totalPayments =
    partPayment && calculableAllocation ? partPayment.amount - paymentRemaining : 0;
  const totalPrincipalOutstanding = rows.reduce(
    (sum, row) => sum + row.principalOutstanding,
    0,
  );
  const totalPreSuitInterest = Math.round(
    rows.reduce((sum, row) => sum + row.preSuitInterest, 0) * 100,
  ) / 100;

  return {
    currency: 'INR',
    annualInterestRate,
    filingDate: isoDate(filingDate),
    allocationMethod,
    invoices: rows,
    totalOriginalPrincipal,
    totalPayments,
    totalPrincipalOutstanding,
    totalPreSuitInterest,
    totalClaimAtFiling:
      Math.round((totalPrincipalOutstanding + totalPreSuitInterest) * 100) / 100,
    issues,
  };
}

export function formatCommercialRecoveryCalculation(
  calculation: CommercialRecoveryCalculation,
): string {
  const rows = calculation.invoices.map(
    (row) =>
      `${row.invoiceNumber}: invoice ${row.invoiceDate}; due ${row.dueDate}; original ₹${row.originalPrincipal.toFixed(2)}; principal paid ₹${row.principalPaid.toFixed(2)}; principal outstanding ₹${row.principalOutstanding.toFixed(2)}; pre-suit interest ₹${row.preSuitInterest.toFixed(2)}`,
  );
  return [
    'DETERMINISTIC COMMERCIAL RECOVERY CALCULATION (use exactly; do not recalculate):',
    ...rows,
    `Total original principal: ₹${calculation.totalOriginalPrincipal.toFixed(2)}`,
    `Total payments allocated: ₹${calculation.totalPayments.toFixed(2)}`,
    `Total principal outstanding: ₹${calculation.totalPrincipalOutstanding.toFixed(2)}`,
    `Total pre-suit interest through ${calculation.filingDate}: ₹${calculation.totalPreSuitInterest.toFixed(2)}`,
    `Total claim at filing: ₹${calculation.totalClaimAtFiling.toFixed(2)}`,
    ...calculation.issues.map((issue) => `CALCULATION BLOCKER: ${issue}`),
  ].join('\n');
}
