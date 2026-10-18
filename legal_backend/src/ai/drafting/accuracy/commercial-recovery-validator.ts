import type { CaseRecord } from '../contracts/case-record';
import {
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';
import type { CommercialRecoveryFactLock } from '@/ai/draft-intent/commercial-recovery-calculator';

function moneyPattern(amount: number): RegExp {
  const indian = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(amount);
  const plain = String(amount);
  return new RegExp(`(?:₹|Rs\\.?|INR)?\\s*(?:${indian.replace(/,/g, '[,]?')}|${plain})\\b`, 'i');
}

function commercialLock(caseRecord: CaseRecord): CommercialRecoveryFactLock | undefined {
  const lock = caseRecord.factLocks?.find(
    (candidate) => candidate.kind === 'commercial_recovery',
  );
  return lock?.payload as CommercialRecoveryFactLock | undefined;
}

export function evaluateCommercialRecoveryDraft(input: {
  caseRecord: CaseRecord;
  caseDetails?: string;
  draftText: string;
  documentKind?: string;
}): AccuracyAuditResult {
  if (input.documentKind !== 'india_suit_recovery_cpc_37') {
    return { findings: [], passed: true };
  }
  const findings: AccuracyFinding[] = [];
  const add = (
    code: string,
    message: string,
    sectionHint?: string,
    repairHint?: string,
  ) =>
    findings.push({
      code,
      severity: 'blocker',
      message,
      sectionHint,
      repairHint,
    });

  const draft = input.draftText;
  const facts = input.caseDetails ?? '';
  const lock = commercialLock(input.caseRecord);

  if (lock) {
    const expectedNumbers = new Set(
      lock.invoices.map((invoice) => invoice.invoiceNumber.toUpperCase()),
    );
    const draftNumbers = [
      ...draft.matchAll(
        /\b(?:invoice(?:\s+no\.?)?\s*)?([A-Z]{2,}[A-Z0-9]*\/[A-Z0-9/-]+)\b/gi,
      ),
    ].map((match) => match[1].toUpperCase());
    const unexpected = [...new Set(draftNumbers)].filter(
      (number) => !expectedNumbers.has(number),
    );
    const missing = [...expectedNumbers].filter(
      (number) => !draft.toUpperCase().includes(number),
    );
    if (unexpected.length || missing.length) {
      add(
        'COMMERCIAL_INVOICE_ID_MISMATCH',
        `Invoice identifiers differ from the locked record. Unexpected: ${unexpected.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}.`,
        'FACTS / INVOICE SCHEDULE',
        'Regenerate the invoice schedule only from the locked invoice rows.',
      );
    }

    for (const invoice of lock.invoices) {
      const index = draft.toUpperCase().indexOf(invoice.invoiceNumber.toUpperCase());
      if (index < 0) continue;
      const row = draft.slice(index, index + 220);
      if (!moneyPattern(invoice.amount).test(row)) {
        add(
          'COMMERCIAL_INVOICE_AMOUNT_MISMATCH',
          `Invoice ${invoice.invoiceNumber} is not paired with its locked amount ₹${invoice.amount}.`,
          'FACTS / INVOICE SCHEDULE',
          'Use the locked invoice amount without arithmetic or formatting changes.',
        );
      }
    }

    for (const payment of lock.payments) {
      if (!moneyPattern(payment.amount).test(draft)) {
        add(
          'COMMERCIAL_PAYMENT_MISMATCH',
          `The locked part-payment of ₹${payment.amount} is missing or altered.`,
          'FACTS / INTEREST SCHEDULE',
        );
      }
    }

    if (lock.blockingIssues.length > 0) {
      add(
        'COMMERCIAL_CALCULATION_INPUTS_UNCONFIRMED',
        `The monetary claim is not filing-ready: ${lock.blockingIssues.join(' ')}`,
        'VALUATION / PRAYER',
        'Confirm calculation assumptions and regenerate the invoice-wise interest schedule.',
      );
    } else if (lock.calculation) {
      if (!moneyPattern(lock.calculation.totalPrincipalOutstanding).test(draft)) {
        add(
          'COMMERCIAL_PRINCIPAL_RECONCILIATION_FAILED',
          'The prayer does not reproduce the deterministically calculated outstanding principal.',
          'PRAYER',
        );
      }
      if (!moneyPattern(lock.calculation.totalPreSuitInterest).test(draft)) {
        add(
          'COMMERCIAL_INTEREST_RECONCILIATION_FAILED',
          'The draft does not reproduce the deterministically calculated pre-suit interest.',
          'INTEREST / PRAYER',
        );
      }
    }
  }

  if (/₹\s*₹|₹₹|₹\s*[,;]/.test(draft)) {
    add(
      'MALFORMED_MONETARY_PLACEHOLDER',
      'The draft contains a malformed or unresolved currency value.',
      'INTEREST / PRAYER',
    );
  }

  const required: Array<[string, RegExp]> = [
    ['COMMERCIAL DISPUTE / MAINTAINABILITY', /commercial dispute|maintainab/i],
    ['JURISDICTION', /\bjurisdiction\b/i],
    ['LIMITATION', /\blimitation\b/i],
    ['VALUATION AND COURT FEE', /\bvaluation\b[\s\S]{0,120}\bcourt[- ]?fee\b/i],
    ['PRAYER', /\bprayer\b/i],
    ['VERIFICATION', /\bverification\b/i],
    ['STATEMENT OF TRUTH', /\bstatement of truth\b/i],
    ['SUPPORTING AFFIDAVIT', /\baffidavit\b/i],
    ['LIST / INDEX OF DOCUMENTS', /\b(?:list|index) of documents\b/i],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(draft)) {
      add(
        `COMMERCIAL_MISSING_${label.replace(/\W+/g, '_')}`,
        `Commercial filing package is missing ${label}.`,
        label,
      );
    }
  }

  const unsupportedAllegations =
    /\b(financial distress|asset dissipation|remove assets|dispose of assets|fraudulent|dishonest|mala fide|criminal conduct)\b/gi;
  const alleged = [...draft.matchAll(unsupportedAllegations)].map((match) =>
    match[0].toLowerCase(),
  );
  const unsupported = [...new Set(alleged)].filter(
    (term) => !facts.toLowerCase().includes(term),
  );
  if (unsupported.length) {
    add(
      'COMMERCIAL_UNSUPPORTED_SERIOUS_ALLEGATION',
      `Unsupported allegation(s) found: ${unsupported.join(', ')}.`,
      'FACTS / INTERIM RELIEF',
      'Remove the allegation or obtain and confirm specific supporting evidence.',
    );
  }

  if (
    /\b(?:email|whatsapp)\b/i.test(facts) &&
    !/\b(?:electronic record|original device|metadata|certificate|complete conversation|export)\b/i.test(
      draft,
    )
  ) {
    add(
      'COMMERCIAL_ELECTRONIC_RECORD_FOUNDATION_MISSING',
      'Email/WhatsApp evidence is relied upon without preservation, source, context, and certificate particulars.',
      'DOCUMENTS / ELECTRONIC EVIDENCE',
    );
  }

  return { findings, passed: auditPassed(findings) };
}
