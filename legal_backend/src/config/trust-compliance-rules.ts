/**
 * Jurisdiction-specific trust accounting compliance rules.
 *
 * References:
 * - US IOLTA: ABA Model Rules 1.15; state bar IOLTA rules
 * - UK SRA: Solicitors Regulation Authority Accounts Rules 2019
 * - KE: Advocates (Accounts) Rules (Cap 16 Sub-Leg)
 * - IN: Bar Council of India Rules, Chapter II Part VI
 */

export interface TrustComplianceRule {
  id: string;
  jurisdiction: string;
  countryCode: string;
  category: string;
  title: string;
  description: string;
  deadline?: string;
  regulation: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  checkType: 'RECONCILIATION' | 'SEGREGATION' | 'DISBURSEMENT' | 'RECORD_KEEPING' | 'REPORTING';
}

export interface TrustCompliancePack {
  countryCode: string;
  jurisdiction: string;
  accountingBody: string;
  regulationName: string;
  regulationUrl: string;
  rules: TrustComplianceRule[];
  reconciliationFrequency: string;
  minimumRecordsRetentionYears: number;
  keyRequirements: string[];
}

export const TRUST_COMPLIANCE_PACKS: TrustCompliancePack[] = [
  // ═══════════════════════════════════════════════════════════
  // UNITED STATES — IOLTA
  // ═══════════════════════════════════════════════════════════
  {
    countryCode: 'US',
    jurisdiction: 'Federal / All States',
    accountingBody: 'State Bar IOLTA Programs / ABA',
    regulationName: 'ABA Model Rules 1.15 — Safekeeping Property',
    regulationUrl: 'https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property/',
    reconciliationFrequency: 'Monthly (3-way reconciliation)',
    minimumRecordsRetentionYears: 7,
    keyRequirements: [
      'Maintain separate IOLTA account for pooled client funds',
      'Complete 3-way reconciliation monthly (bank balance = book balance = client ledger sum)',
      'Promptly notify clients of receipt of funds',
      'Never commingle client and firm funds',
      'Disburse client funds only upon proper authorization',
      'Maintain individual client ledger cards',
      'Report interest earned to state IOLTA program',
    ],
    rules: [
      {
        id: 'us-iolta-001',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: 'Monthly 3-Way Reconciliation',
        description: 'Reconcile bank statement balance, book balance (trust ledger), and sum of individual client ledger balances monthly. All three must agree.',
        deadline: 'Monthly — within 30 days of bank statement date',
        regulation: 'ABA Model Rule 1.15; state bar rules',
        severity: 'CRITICAL',
        checkType: 'RECONCILIATION',
      },
      {
        id: 'us-iolta-002',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: 'Client Ledger Maintenance',
        description: 'Maintain a separate ledger for each client showing all receipts and disbursements. Running balance must be maintained.',
        regulation: 'ABA Model Rule 1.15(a)',
        severity: 'CRITICAL',
        checkType: 'RECORD_KEEPING',
      },
      {
        id: 'us-iolta-003',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: 'No Commingling',
        description: 'Client funds must never be mixed with firm operating funds. Only the minimum amount needed to avoid bank service fees may be from firm funds.',
        regulation: 'ABA Model Rule 1.15(a)',
        severity: 'CRITICAL',
        checkType: 'SEGREGATION',
      },
      {
        id: 'us-iolta-004',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: 'Prompt Notification',
        description: 'Promptly notify the client when funds are received on their behalf.',
        regulation: 'ABA Model Rule 1.15(d)',
        severity: 'HIGH',
        checkType: 'DISBURSEMENT',
      },
      {
        id: 'us-iolta-005',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: 'IOLTA Interest Reporting',
        description: 'Interest earned on pooled IOLTA accounts must be remitted to the state IOLTA program, not retained by the firm.',
        regulation: 'State IOLTA Rules',
        severity: 'HIGH',
        checkType: 'REPORTING',
      },
      {
        id: 'us-iolta-006',
        jurisdiction: 'US',
        countryCode: 'US',
        category: 'IOLTA',
        title: '7-Year Record Retention',
        description: 'All trust account records must be retained for a minimum of 7 years (varies by state — some require 5 years).',
        regulation: 'ABA Model Rule 1.15(a)',
        severity: 'MEDIUM',
        checkType: 'RECORD_KEEPING',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // UNITED KINGDOM — SRA Accounts Rules 2019
  // ═══════════════════════════════════════════════════════════
  {
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    accountingBody: 'Solicitors Regulation Authority (SRA)',
    regulationName: 'SRA Accounts Rules 2019',
    regulationUrl: 'https://www.sra.org.uk/solicitors/standards-regulations/accounts-rules/',
    reconciliationFrequency: 'At least every 5 weeks (Rule 8.3)',
    minimumRecordsRetentionYears: 6,
    keyRequirements: [
      'Reconcile client account ledger with bank statements at least every 5 weeks',
      'Promptly pay client money into client account',
      'Never use client money for firm benefit',
      'Obtain COT (Completion of Title) from mortgage lenders',
      'Qualified accountant\'s report annually (may be waived for small practices)',
      'Promptly return client money when no longer required',
      'Maintain residual balances register',
    ],
    rules: [
      {
        id: 'uk-sra-001',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: '5-Week Reconciliation Rule',
        description: 'Bank reconciliation must be carried out at least every 5 weeks. Compare client account bank statement with client account ledger and client matter ledger totals.',
        deadline: 'At least every 5 weeks — Rule 8.3',
        regulation: 'SRA Accounts Rules 2019 Rule 8.3',
        severity: 'CRITICAL',
        checkType: 'RECONCILIATION',
      },
      {
        id: 'uk-sra-002',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: 'Prompt Payment into Client Account',
        description: 'Client money must be paid into a client account promptly — same day or next working day unless agreed otherwise.',
        regulation: 'SRA Accounts Rules 2019 Rule 2.3',
        severity: 'CRITICAL',
        checkType: 'DISBURSEMENT',
      },
      {
        id: 'uk-sra-003',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: 'No Client Money for Firm Benefit',
        description: 'Client money must not be used to fund the firm\'s business — even temporarily. Rule 5.3 prohibition on using client account as banking facility.',
        regulation: 'SRA Accounts Rules 2019 Rules 5.1 and 5.3',
        severity: 'CRITICAL',
        checkType: 'SEGREGATION',
      },
      {
        id: 'uk-sra-004',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: 'Annual Accountant\'s Report',
        description: 'Firms holding client money must obtain a qualified accountant\'s report within 6 months of year-end (unless exempt under Rule 12).',
        deadline: 'Within 6 months of accounting year end — Rule 12',
        regulation: 'SRA Accounts Rules 2019 Rules 12–13',
        severity: 'HIGH',
        checkType: 'REPORTING',
      },
      {
        id: 'uk-sra-005',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: 'Residual Client Balances',
        description: 'Residual balances (money held for clients who cannot be located or small unclaimed amounts) must be tracked and managed per Rule 2.5.',
        regulation: 'SRA Accounts Rules 2019 Rule 2.5',
        severity: 'MEDIUM',
        checkType: 'RECORD_KEEPING',
      },
      {
        id: 'uk-sra-006',
        jurisdiction: 'England & Wales',
        countryCode: 'GB',
        category: 'SRA Accounts Rules',
        title: '6-Year Record Retention',
        description: 'All client account records, ledger entries, bank statements, and reconciliation statements must be retained for at least 6 years.',
        regulation: 'SRA Accounts Rules 2019 Rule 14',
        severity: 'MEDIUM',
        checkType: 'RECORD_KEEPING',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // KENYA — Advocates (Accounts) Rules
  // ═══════════════════════════════════════════════════════════
  {
    countryCode: 'KE',
    jurisdiction: 'Kenya',
    accountingBody: 'Law Society of Kenya (LSK)',
    regulationName: "Advocates (Accounts) Rules (Cap 16 Sub-Leg)",
    regulationUrl: 'https://kenyalaw.org/kl/fileadmin/pdfdownloads/LegalNotices/1981/LN118_1981.pdf',
    reconciliationFrequency: 'Monthly',
    minimumRecordsRetentionYears: 6,
    keyRequirements: [
      'Maintain a separate client account at a licensed bank',
      'All client money to be deposited without delay',
      'Monthly reconciliation of client accounts',
      'Annual audit by certified public accountant',
      'File auditor\'s report with LSK annually',
      'Written accounting in at least 3 months intervals',
      'Retain records for minimum 6 years',
    ],
    rules: [
      {
        id: 'ke-accounts-001',
        jurisdiction: 'Kenya',
        countryCode: 'KE',
        category: 'Advocates Accounts Rules',
        title: 'Separate Client Bank Account',
        description: 'Every advocate must maintain a separate client account at a recognised bank. Client money must not be mixed with office money.',
        regulation: 'Advocates (Accounts) Rules Rule 3',
        severity: 'CRITICAL',
        checkType: 'SEGREGATION',
      },
      {
        id: 'ke-accounts-002',
        jurisdiction: 'Kenya',
        countryCode: 'KE',
        category: 'Advocates Accounts Rules',
        title: 'Monthly Client Account Reconciliation',
        description: 'Client accounts must be reconciled monthly. Bank statements must be reconciled against the client ledger and client list totals.',
        deadline: 'Monthly',
        regulation: 'Advocates (Accounts) Rules Rule 6',
        severity: 'CRITICAL',
        checkType: 'RECONCILIATION',
      },
      {
        id: 'ke-accounts-003',
        jurisdiction: 'Kenya',
        countryCode: 'KE',
        category: 'Advocates Accounts Rules',
        title: 'Annual Audit and LSK Report',
        description: 'Annual audit by a certified public accountant. The auditor\'s report must be filed with the Law Society of Kenya within 6 months of year end.',
        deadline: 'Within 6 months of financial year end',
        regulation: 'Advocates (Accounts) Rules Rule 9',
        severity: 'HIGH',
        checkType: 'REPORTING',
      },
      {
        id: 'ke-accounts-004',
        jurisdiction: 'Kenya',
        countryCode: 'KE',
        category: 'Advocates Accounts Rules',
        title: 'Prompt Deposit of Client Funds',
        description: 'Any monies held on behalf of clients must be deposited in the client account without delay — not later than the next working day.',
        regulation: 'Advocates (Accounts) Rules Rule 4',
        severity: 'HIGH',
        checkType: 'DISBURSEMENT',
      },
      {
        id: 'ke-accounts-005',
        jurisdiction: 'Kenya',
        countryCode: 'KE',
        category: 'Advocates Accounts Rules',
        title: '6-Year Record Retention',
        description: 'All books of account, ledgers, statements, and supporting documents must be kept for at least 6 years.',
        regulation: 'Advocates (Accounts) Rules Rule 10',
        severity: 'MEDIUM',
        checkType: 'RECORD_KEEPING',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // INDIA — Bar Council of India Rules
  // ═══════════════════════════════════════════════════════════
  {
    countryCode: 'IN',
    jurisdiction: 'India',
    accountingBody: 'Bar Council of India (BCI)',
    regulationName: 'Bar Council of India Rules, Part VI Chapter II — Duty to Clients',
    regulationUrl: 'https://www.barcouncilofindia.org/rules/standards-of-professional-conduct-and-etiquette/',
    reconciliationFrequency: 'As required by professional standards',
    minimumRecordsRetentionYears: 3,
    keyRequirements: [
      'Maintain separate bank account for client funds (escrow)',
      'Do not misappropriate client funds under any circumstances',
      'Promptly account to client for all money received on their behalf',
      'Do not withhold funds due to client beyond reasonable retention',
      'Maintain proper accounts with receipts and disbursements',
      'Obtain written authority before disbursing client funds',
    ],
    rules: [
      {
        id: 'in-bci-001',
        jurisdiction: 'India',
        countryCode: 'IN',
        category: 'BCI Rules',
        title: 'Separate Client Escrow Account',
        description: 'Advocates handling client money (e.g. court deposits, settlement funds) should maintain a separate bank account for client funds.',
        regulation: 'BCI Rules Part VI Chapter II — Standards of Professional Conduct',
        severity: 'CRITICAL',
        checkType: 'SEGREGATION',
      },
      {
        id: 'in-bci-002',
        jurisdiction: 'India',
        countryCode: 'IN',
        category: 'BCI Rules',
        title: 'No Misappropriation',
        description: 'An advocate must not misappropriate client money. Misappropriation is professional misconduct and grounds for suspension or removal from the roll.',
        regulation: 'Advocates Act 1961 s.35; BCI Rules',
        severity: 'CRITICAL',
        checkType: 'SEGREGATION',
      },
      {
        id: 'in-bci-003',
        jurisdiction: 'India',
        countryCode: 'IN',
        category: 'BCI Rules',
        title: 'Prompt Accounting to Client',
        description: 'Promptly account to the client for any money received on their behalf. Provide receipts and statements of account.',
        regulation: 'BCI Rules Part VI Chapter II',
        severity: 'HIGH',
        checkType: 'DISBURSEMENT',
      },
      {
        id: 'in-bci-004',
        jurisdiction: 'India',
        countryCode: 'IN',
        category: 'BCI Rules',
        title: 'Written Authority for Disbursements',
        description: 'Obtain written or email authority from the client before disbursing their funds, particularly for significant payments.',
        regulation: 'BCI Rules Part VI Chapter II',
        severity: 'HIGH',
        checkType: 'DISBURSEMENT',
      },
      {
        id: 'in-bci-005',
        jurisdiction: 'India',
        countryCode: 'IN',
        category: 'BCI Rules',
        title: 'Maintain Receipts and Disbursement Records',
        description: 'Keep proper accounts of all client money received and disbursed with supporting receipts and payment vouchers.',
        regulation: 'BCI Rules Part VI Chapter II',
        severity: 'MEDIUM',
        checkType: 'RECORD_KEEPING',
      },
    ],
  },
];

export function getTrustCompliancePack(
  countryCode: string,
): TrustCompliancePack | undefined {
  return TRUST_COMPLIANCE_PACKS.find(
    (p) => p.countryCode.toUpperCase() === countryCode.toUpperCase(),
  );
}

export function getAllTrustRules(): TrustComplianceRule[] {
  return TRUST_COMPLIANCE_PACKS.flatMap((p) => p.rules);
}
