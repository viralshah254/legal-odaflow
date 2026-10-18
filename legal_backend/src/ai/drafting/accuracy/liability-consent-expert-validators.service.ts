import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import { isResearchMemoKind } from '../draft-kind.util';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

/** Liability separation, consent, expert-evidence, and record-integrity checks. */
@Injectable()
export class LiabilityConsentExpertValidatorsService {
  readonly version = 'liability-consent-expert-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    caseDetails?: string;
    documentKind?: string;
    consumerMatterSignals?: boolean;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { draftText, caseDetails = '', documentKind, caseRecord, consumerMatterSignals } = input;
    const isResearchMemo = isResearchMemoKind(documentKind ?? '');
    const intakeHay = [
      caseDetails,
      ...(caseRecord.facts ?? []).map((f) => f.proposition),
    ].join('\n');
    const isMedNeg =
      /medical_negligence|consumer/i.test(documentKind ?? '') ||
      consumerMatterSignals === true ||
      /\b(medical\s+negligence|informed\s+consent|gallbladder|hospital|deficiency\s+in\s+service)\b/i.test(
        intakeHay,
      );
    if (!isMedNeg) return { findings, passed: true };

    const intake = intakeHay.toLowerCase();

    // Do not pin surgical injury on anaesthesiologist without support
    if (
      /\b(dr\.?\s*rao|anaesthesiologist|anesthesiologist)\b.{0,80}\b(bile[\s-]?duct|surgical\s+injury|caused\s+the\s+injury)\b/i.test(
        draftText,
      ) &&
      !/\b(rao|anaesthesiologist).{0,60}(bile|surgical\s+injury|caused)\b/i.test(intake)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.UNSUPPORTED_MATERIAL_FACT,
        severity: 'blocker',
        message:
          'Draft attributes surgical/bile-duct injury to the anaesthesiologist without CaseRecord support.',
        repairHint: 'Separate liability theories; do not assert unsupported causation against Dr. Rao.',
      });
    }

    // Consent defects must be alleged, not conclusive
    const consentDefectPattern =
      /\b(absence\s+of\s+consent|no\s+consent\s+was\s+obtained|consent\s+was\s+not\s+obtained|consent\s+was\s+signed|did\s+not\s+sign|denies\s+signing|denied\s+signing)\b/gi;
    const allegationQualifier =
      /\b(alleged|allegedly|disputed|subject\s+to\s+proof|it\s+is\s+submitted|appears|may\s+have|possibly)\b/i;
    if (consentDefectPattern.test(draftText)) {
      const consentMatches = [...draftText.matchAll(consentDefectPattern)];
      const unqualified = consentMatches.some((m) => {
        const idx = m.index ?? 0;
        const window = draftText.slice(Math.max(0, idx - 200), idx + (m[0]?.length ?? 0) + 200);
        return !allegationQualifier.test(window);
      });
      if (unqualified) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED,
          severity: 'blocker',
          message: 'Consent defect stated as established fact rather than allegation.',
          repairHint: 'Plead consent defects as allegations subject to proof.',
        });
      }
    }

    // Automatic res ipsa — skip strategy recommendations in NEXT STEPS for research memos
    const resIpsaTarget = isResearchMemo
      ? draftText.replace(
          /(^|\n)\s*##?\s*NEXT\s+STEPS[\s\S]*$/i,
          '',
        )
      : draftText;
    if (
      /\bres\s+ipsa\s+loquitur\b/i.test(resIpsaTarget) &&
      /\b(automatically|ipso\s+facto|necessarily\s+applies|clearly\s+applies)\b/i.test(
        resIpsaTarget,
      )
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.PRAYER_EXCEEDS_LEGAL_TEST,
        severity: 'blocker',
        message: 'Draft asserts res ipsa loquitur automatically without nuanced pleading.',
        repairHint: 'Do not assert res ipsa automatically; plead facts supporting inference if any.',
      });
    }

    // Record forgery as conclusive
    if (
      /\b(forged|tampered|manipulated|fabricated)\b.{0,40}\b(record|consent|notes?)\b/i.test(
        draftText,
      ) &&
      !/\b(alleged|allegedly|suspected|apparent\s+inconsistenc)/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.DOCUMENT_STATUS_MISSTATED,
        severity: 'blocker',
        message: 'Draft asserts conclusive record forgery/tampering.',
        repairHint: 'Plead inconsistencies as alleged / apparent; seek preservation/production.',
      });
    }

    // Expert opinion without qualifier
    if (
      /\b(private\s+expert|expert\s+opinion|independent\s+medical)\b.{0,60}\b(proves|establishes|confirms\s+negligence)\b/i.test(
        draftText,
      )
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.EXPERT_OPINION_STATED_AS_FACT,
        severity: 'blocker',
        message: 'Private expert opinion treated as conclusive proof of negligence.',
        repairHint: 'Qualify as probable / based on available records / subject to trial.',
      });
    }

    // Invented doctor qualifications
    if (
      /\b(MBBS|MS|MD|FRCS|qualification|registered\s+medical\s+practitioner)\b/i.test(
        draftText,
      ) &&
      !/\b(MBBS|MS|MD|FRCS|qualification|registered)\b/i.test(intake)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.UNSUPPORTED_MATERIAL_FACT,
        severity: 'blocker',
        message: 'Draft invents doctor qualifications / registration not present in CaseRecord.',
        repairHint: 'Omit qualification details unless confirmed in CaseRecord.',
      });
    }

    // Vicarious / direct insurer liability when intake only names insurer for cashless eligibility
    const noRepudiation =
      /\b(?:no\s+(?:insurance\s+)?claim\s+(?:has\s+been\s+)?(?:filed|denied)|not\s+(?:yet\s+)?repudiat|cashless[\s-]?eligible|named\s+(?:only\s+)?because)\b/i.test(
        intake,
      );
    const insurerLiabilityTheory =
      /\b(?:vicarious\s+liability|direct\s+liability|liable\s+for\s+negligence).{0,80}\b(?:insur|securecare|policy\s+holder)/i.test(
        draftText,
      ) ||
      /\b(?:insur|securecare).{0,80}\b(?:vicarious|direct\s+liability|negligent|deficien)/i.test(
        draftText,
      );
    const hasAffirmativeRepudiation =
      /\b(repudiat(?:ed|ion)|claim\s+deni|denied\s+the\s+claim|wrongful\s+repudiation)\b/i.test(
        intake,
      ) && !/\bno\s+repudiation\b/i.test(intake);
    if (noRepudiation && insurerLiabilityTheory && !hasAffirmativeRepudiation) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL,
        severity: 'blocker',
        message:
          'Draft asserts insurer vicarious/direct liability theory when intake only names insurer for cashless eligibility.',
        repairHint:
          'Do not invent insurer liability theories; insurer is named for cashless eligibility only unless repudiation is in CaseRecord.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
