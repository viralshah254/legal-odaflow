import { Injectable } from '@nestjs/common';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';
import { isFamilyMatrimonialKind } from '../draft-kind.util';

@Injectable()
export class ReliefTestValidatorService {
  readonly version = 'relief-test-v1';

  evaluate(input: {
    draftText: string;
    documentKind?: string;
  }): AccuracyAuditResult {
    if (/research_memo|case_strategy|legal_research/i.test(input.documentKind ?? '')) {
      return { findings: [], passed: true };
    }

    const findings: AccuracyFinding[] = [];
    const text = input.draftText;

    if (!/\bprayer\b|\bwherefore\b|\brelief\s+claimed\b/i.test(text)) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.RELIEF_TEST_NOT_PLEADED,
        severity: 'blocker',
        message: 'Draft lacks a prayer / relief claimed section.',
      });
    }

    if (
      /interim|preservation|production/i.test(input.documentKind ?? '') &&
      !/\b(urgenc|imminent|irreparable|preservation)\b/i.test(text)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.INTERIM_RELIEF_URGENCY_MISSING,
        severity: 'warning',
        message: 'Interim / preservation application lacks urgency pleading.',
      });
    }

    if (
      /\bres\s+ipsa\s+loquitur\b/i.test(text) &&
      /\b(automatically|necessarily|conclusively)\b.{0,40}\bres\s+ipsa/i.test(text)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.PRAYER_EXCEEDS_LEGAL_TEST,
        severity: 'blocker',
        message: 'Draft treats res ipsa loquitur as automatically conclusive.',
        repairHint: 'Plead res ipsa cautiously as an available inference, not automatic proof.',
      });
    }

    const isFamily = isFamilyMatrimonialKind(input.documentKind ?? '');
    if (isFamily) {
      if (/\bCIVIL\s+SUIT\s+NO\.?\b/i.test(text) || /\bSUIT\s+FOR\b/i.test(text)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_PROCEEDING_FORM,
          severity: 'blocker',
          message: 'Family matrimonial petition uses civil suit caption (CIVIL SUIT NO. / SUIT FOR).',
          repairHint:
            'Use Family Court petition caption: PETITION NO., PETITION FOR DIVORCE UNDER SECTION 13, HMA 1955.',
        });
      }

      const dvAsDivorceGround =
        /(?:ground|grounds)[^.\n]{0,200}(?:domestic\s+violence|protection\s+of\s+women)[^.\n]{0,200}(?:divorce|dissolution|hma|hindu\s+marriage)/i.test(
          text,
        ) ||
        /(?:divorce|dissolution)[^.\n]{0,120}(?:domestic\s+violence\s+act|dv\s+act)\s+(?:as\s+)?(?:a\s+)?ground/i.test(
          text,
        );
      if (dvAsDivorceGround) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_RELIEF_VEHICLE,
          severity: 'blocker',
          message:
            'Draft cites the Domestic Violence Act as a statutory ground for divorce under HMA §13.',
          repairHint:
            'DV Act provides independent civil remedies — plead cruelty under HMA §13(1)(ia) using DV incidents as factual support only.',
        });
      }

      if (
        /\bBNS\s*(?:§|s\.?|Section\s*)144\b/i.test(text) ||
        /\bSection\s+144\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita/i.test(text)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          severity: 'blocker',
          message:
            'Divorce petition cites BNS §144 for maintenance — BNS is substantive criminal law; maintenance in divorce should be under HMA §24/§25.',
          repairHint: 'Pray maintenance under HMA §24 (pendente lite) and §25 (permanent alimony).',
        });
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}
