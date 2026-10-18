import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class AdverseMaterialValidatorService {
  readonly version = 'adverse-material-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    caseDetails?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const intake = (input.caseDetails ?? '').toLowerCase();
    const draft = input.draftText.toLowerCase();

    // Hospital medical board / recognised complication adverse to complainant
    if (
      /\b(recognised\s+complication|medical\s+board|hospital.?s\s+medical\s+board)\b/i.test(intake) &&
      !/\b(recognised\s+complication|medical\s+board|adverse)\b/i.test(draft)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.MATERIAL_ADVERSE_FACT_OMITTED,
        severity: 'warning',
        message:
          'Intake contains hospital medical-board / recognised-complication defence not addressed in draft.',
        repairHint: 'Plead and distinguish adverse medical-board position.',
      });
    }

    // AUTHORITIES section must address adverse/limiting authority when intake has hospital-board defence
    if (
      /\b(recognised\s+complication|medical\s+board|hospital.?s\s+medical\s+board)\b/i.test(intake)
    ) {
      const authoritiesSlice = input.draftText
        .split(/#{1,3}\s*authorit|AUTHORITIES/i)
        .slice(1)
        .join('')
        .slice(0, 3000);
      const hasAdverseInAuthorities =
        /\b(recognised\s+complication|medical\s+board|adverse|limiting|distinguish)\b/i.test(
          authoritiesSlice || draft,
        );
      if (!hasAdverseInAuthorities) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.MATERIAL_ADVERSE_AUTHORITY_OMITTED,
          severity: 'blocker',
          message:
            'Intake has hospital-board / recognised-complication facts but AUTHORITIES lacks adverse or limiting authority.',
          sectionHint: 'AUTHORITIES',
          repairHint:
            'Cite and distinguish adverse material (recognised complication / medical board position) in AUTHORITIES.',
        });
      }
    }

    // Private expert uses "probable" — must remain qualified if mentioned
    if (
      /\bprobable\b/i.test(intake) &&
      /\bexpert\b/i.test(draft) &&
      /\b(conclusively|definitely\s+proves|established\s+negligence)\b/i.test(input.draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.MISLEADING_SELECTIVE_PLEADING,
        severity: 'blocker',
        message: 'Draft overstates expert opinion that intake qualifies as probable.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
