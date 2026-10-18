import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class AnnexureEvidenceValidatorService {
  readonly version = 'annexure-evidence-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    documentKind?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText, documentKind } = input;
    const filingGrade = /consumer|plaint|bail|writ|complaint|affidavit/i.test(
      documentKind ?? '',
    );
    if (!filingGrade) return { findings, passed: true };

    const annexureRefs = [
      ...draftText.matchAll(/\b(?:Annexure|Ann\.|Exhibit)\s*[-–]?\s*([A-Z0-9]+)\b/gi),
    ];
    const hasList =
      /\b(list\s+of\s+documents|index\s+of\s+annexures|schedule\s+of\s+documents)\b/i.test(
        draftText,
      );

    if (annexureRefs.length > 0 && !hasList) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.MISSING_ANNEXURE_LIST,
        severity: 'warning',
        message: 'Draft cites annexures without a list of documents / annexure index.',
        repairHint: 'Add numbered list of documents matching annexure references.',
      });
    }

    for (const ev of caseRecord.evidence ?? []) {
      const key = (ev.description || '').slice(0, 24).toLowerCase();
      if (key.length < 8) continue;
      if (
        /\b(disputed|forgery|tamper|manipulat)/i.test(ev.description) &&
        draftText.toLowerCase().includes(key) &&
        !/\b(alleged|disputed|subject\s+to\s+proof|purported)\b/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.DISPUTED_DOCUMENT_NOT_QUALIFIED,
          severity: 'blocker',
          message: `Disputed evidence "${ev.description.slice(0, 60)}" not pleaded as disputed/alleged.`,
          repairHint: 'Qualify disputed documents; do not assert conclusive forgery.',
        });
      }
    }

    if (
      /\b(electronic\s+record|CCTV|WhatsApp|email|SMS)\b/i.test(draftText) &&
      !/\b(Section\s*65B|65-B|certificate|electronic\s+record\s+foundation)\b/i.test(
        draftText,
      ) &&
      /\b(proves|establishes|conclusively)\b/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.ELECTRONIC_RECORD_FOUNDATION_MISSING,
        severity: 'warning',
        message:
          'Electronic records relied on conclusively without Evidence Act §65B foundation language.',
        repairHint: 'Plead §65B certificate / foundation or qualify reliance.',
      });
    }

    if (
      /\bAnnexure\s+[A-Z]\b/i.test(draftText) &&
      caseRecord.evidence.length === 0 &&
      !/\b\[BLANK/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.ANNEXURE_REFERENCE_MISSING,
        severity: 'warning',
        message: 'Annexure cited but CaseRecord has no evidence items linked.',
        repairHint: 'Align annexures with CaseRecord evidence list.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
