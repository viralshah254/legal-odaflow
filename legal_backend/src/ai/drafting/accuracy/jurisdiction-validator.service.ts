import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

function isConsumerMatter(
  documentKind: string | undefined,
  caseRecord: CaseRecord,
  caseDetails?: string,
  force?: boolean,
): boolean {
  if (force) return true;
  if (/consumer|medical_negligence|document_production|research_memo|case_strategy|legal_research/i.test(
    documentKind ?? '',
  )) {
    // Research memo: only treat as consumer if intake/facts look consumer
    if (/research_memo|case_strategy|legal_research/i.test(documentKind ?? '')) {
      const hay = [
        caseDetails ?? '',
        ...(caseRecord.facts ?? []).map((f) => f.proposition),
        caseRecord.jurisdiction?.courtName ?? '',
      ].join('\n');
      return /\b(consumer|deficiency|medical\s+negligence|opposite\s+part|hospital|commission)\b/i.test(
        hay,
      );
    }
    return true;
  }
  const hay = [
    caseDetails ?? '',
    ...(caseRecord.facts ?? []).map((f) => f.proposition),
    caseRecord.jurisdiction?.courtName ?? '',
  ].join('\n');
  return /\b(consumer\s+commission|consumer\s+protection|deficiency\s+in\s+service|medical\s+negligence)\b/i.test(
    hay,
  );
}

@Injectable()
export class JurisdictionValidatorService {
  readonly version = 'jurisdiction-v2';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    documentKind?: string;
    caseDetails?: string;
    consumerMatterSignals?: boolean;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText, documentKind } = input;
    const isConsumer = isConsumerMatter(
      documentKind,
      caseRecord,
      input.caseDetails,
      input.consumerMatterSignals,
    );

    if (isConsumer) {
      if (
        /\bdistrict\s+court\b/i.test(draftText) &&
        !/\bconsumer\s+(disputes\s+)?(redressal\s+)?commission|consumer\s+forum\b/i.test(
          draftText,
        )
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_FORUM,
          severity: 'blocker',
          message: 'Consumer matter drafted as District Court without Consumer Commission forum.',
          repairHint: 'Use District/State/National Consumer Disputes Redressal Commission.',
        });
      }

      if (
        /pecuniary.{0,100}(exceeds\s+₹?\s*1\s*crore|1\s*crore.{0,40}10\s*crore)/i.test(draftText) ||
        /district\s+consumer.{0,120}(1\s*crore.{0,40}10\s*crore|exceeds\s+₹?\s*1\s*crore)/i.test(
          draftText,
        )
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.PECUNIARY_BASIS_UNSUPPORTED,
          severity: 'blocker',
          message:
            'Pecuniary jurisdiction narrative uses unsupported District Commission ₹1–10 crore band.',
          repairHint:
            'Apply current CPA 2019 pecuniary thresholds; mark needs_confirmation if amount unknown.',
        });
      }

      const city =
        caseRecord.jurisdiction?.stateOrRegion ||
        caseRecord.jurisdiction?.courtName ||
        '';
      if (
        /ahmedabad/i.test(
          [
            city,
            input.caseDetails ?? '',
            ...(caseRecord.facts ?? []).map((f) => f.proposition),
          ].join(' '),
        ) &&
        /\bconsumer\b/i.test(draftText) &&
        !/\bahmedabad\b/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.TERRITORIAL_BASIS_UNSUPPORTED,
          severity: 'warning',
          message: 'CaseRecord points to Ahmedabad but draft omits Ahmedabad territorial basis.',
        });
      }

      if (
        /\bjurisdiction\b/i.test(draftText) &&
        !/\b(territorial|pecuniary|section\s*34|§\s*34|section\s*47|§\s*47|needs?\s+confirmation)\b/i.test(
          draftText,
        )
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.STATE_RULE_CONFIRMATION_REQUIRED,
          severity: 'warning',
          message:
            'Jurisdiction discussion lacks clear territorial/pecuniary basis under CPA 2019.',
        });
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}
