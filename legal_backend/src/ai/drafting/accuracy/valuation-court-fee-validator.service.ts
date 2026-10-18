import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class ValuationCourtFeeValidatorService {
  readonly version = 'valuation-court-fee-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    documentKind?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText, documentKind } = input;
    const isConsumer = /consumer|medical_negligence/i.test(documentKind ?? '');
    const isCivil = /plaint|suit|civil/i.test(documentKind ?? '');

    if (!isConsumer && !isCivil) {
      return { findings, passed: true };
    }

    const money = caseRecord.moneyRecords ?? [];
    const knownAmounts = money
      .map((m) => m.amountLabel || String(m.amount))
      .filter(Boolean);

    if (
      /\b(valuation|valued\s+at|suit\s+valuation|claim\s+value)\b/i.test(draftText) &&
      /₹\s*1\s*[-–]\s*10\s*crore|1\s*crore\s+to\s+10\s*crore/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.VALUATION_BASIS_WRONG,
        severity: 'blocker',
        message:
          'Valuation / pecuniary narrative uses an unsupported ₹1–10 crore District band.',
        repairHint:
          'State valuation from CaseRecord claim amount; confirm current CPA / court-fee rules.',
      });
    }

    if (isCivil && /\bcourt\s*fee\b/i.test(draftText) === false && /\bplaint\b/i.test(documentKind ?? '')) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.COURT_FEE_BASIS_WRONG,
        severity: 'warning',
        message: 'Civil plaint omits court-fee / valuation pleading.',
        repairHint: 'Plead valuation and court-fee basis; mark needs_confirmation if state rules uncertain.',
      });
    }

    if (isConsumer && knownAmounts.length > 0) {
      const draftHasAny = knownAmounts.some((a) =>
        draftText.toLowerCase().includes(String(a).toLowerCase().replace(/\s+/g, ' ')),
      );
      if (!draftHasAny && /\bcompensation|claim\b/i.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.VALUATION_BASIS_WRONG,
          severity: 'warning',
          message: 'Known compensation amounts from CaseRecord are missing from valuation/claim narrative.',
          repairHint: 'Include CaseRecord money records in valuation / prayer particulars.',
        });
      }
    }

    if (
      /\bcourt\s*fee\b/i.test(draftText) &&
      !/\b(needs?\s+confirmation|subject\s+to|as\s+per\s+schedule|state\s+rules?)\b/i.test(
        draftText,
      ) &&
      /\bexactly\s+₹|\bfixed\s+at\s+₹\b/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.STATE_RULE_CONFIRMATION_REQUIRED,
        severity: 'blocker',
        message: 'Court-fee stated as fixed without local-rule confirmation.',
        repairHint: 'Mark court fee as needs_confirmation pending state schedule review.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
