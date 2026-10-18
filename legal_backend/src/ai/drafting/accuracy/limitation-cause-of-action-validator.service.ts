import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class LimitationCauseOfActionValidatorService {
  readonly version = 'limitation-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    documentKind?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const filingGrade =
      /consumer|plaint|complaint|petition|bail|writ|appeal/i.test(input.documentKind ?? '') &&
      !/research_memo|case_strategy|legal_research/i.test(input.documentKind ?? '');
    if (!filingGrade) return { findings, passed: true };

    if (!/\blimitation\b|\bcause\s+of\s+action\b|\bsection\s*69\b|\b§\s*69\b/i.test(input.draftText)) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.LIMITATION_NOT_ANALYSED,
        severity: 'warning',
        message: 'Draft does not analyse limitation / cause of action.',
        repairHint: 'Plead limitation basis from CaseRecord chronology (CPA §69 where consumer).',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
