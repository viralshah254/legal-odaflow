import { Injectable } from '@nestjs/common';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class CourtLanguageValidatorService {
  readonly version = 'court-language-v1';

  evaluate(input: { draftText: string }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const text = input.draftText;

    if (/\b(guarantee[sd]?|will\s+certainly\s+succeed|slam\s+dunk)\b/i.test(text)) {
      findings.push({
        code: 'COURT_LANGUAGE_GUARANTEE',
        severity: 'warning',
        message: 'Draft uses guarantee-of-success language inappropriate for pleadings.',
      });
    }

    if (
      /\b(beyond\s+reasonable\s+doubt)\b/i.test(text) &&
      /\bconsumer\b/i.test(text)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED,
        severity: 'warning',
        message: 'Consumer pleading appears to invoke criminal standard of proof.',
        repairHint: 'Use preponderance of probabilities for consumer complaints.',
      });
    }

    if (/\b(shocking|outrageous|callous\s+disregard)\b/i.test(text) && !/\balleg/i.test(text)) {
      findings.push({
        code: 'COURT_LANGUAGE_INFLAMMATORY',
        severity: 'info',
        message: 'Inflammatory adjectives without allegation framing.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
