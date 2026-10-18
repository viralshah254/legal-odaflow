import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';
import { isFamilyMatrimonialKind } from '../draft-kind.util';

const NAME_NOISE =
  /\b(offered|refund|agreed|stated|claims|refused|alleges|contends|residing|aged|years)\b/i;

const CONSUMER_KIND = /consumer|medical_negligence|document_production|research_memo|case_strategy|legal_research/i;

function consumerSignals(
  documentKind: string | undefined,
  caseRecord: CaseRecord,
  caseDetails?: string,
  forceConsumer?: boolean,
): boolean {
  if (forceConsumer) return true;
  if (CONSUMER_KIND.test(documentKind ?? '')) return true;
  const hay = [
    caseDetails ?? '',
    ...(caseRecord.facts ?? []).map((f) => f.proposition),
    caseRecord.jurisdiction?.courtName ?? '',
  ].join('\n');
  return /\b(consumer\s+commission|consumer\s+protection|deficiency\s+in\s+service|opposite\s+part(?:y|ies)|medical\s+negligence|informed\s+consent)\b/i.test(
    hay,
  );
}

@Injectable()
export class PartyEntityValidatorService {
  readonly version = 'party-entity-v2';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    documentKind?: string;
    caseDetails?: string;
    consumerMatterSignals?: boolean;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText, documentKind } = input;
    const parties = caseRecord.parties ?? [];
    const isConsumer = consumerSignals(
      documentKind,
      caseRecord,
      input.caseDetails,
      input.consumerMatterSignals,
    );

    for (const p of parties) {
      if (!p.name?.trim() || NAME_NOISE.test(p.name) || p.name.split(/\s+/).length > 12) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.PARTY_NAME_CORRUPTED,
          severity: 'blocker',
          message: `Party name looks corrupted or is a prose fragment: "${p.name}"`,
          repairHint: 'Replace with the labeled party name from CaseRecord.',
        });
      }
      if (p.name && !draftText.toLowerCase().includes(p.name.toLowerCase().slice(0, 12))) {
        if (p.name.length >= 8) {
          findings.push({
            code: ACCURACY_BLOCKER_CODES.MATERIAL_PARTY_OMITTED,
            severity: 'blocker',
            message: `Material party "${p.name}" (${p.role}) does not appear in the draft.`,
            repairHint: 'Add the party to the document using CaseRecord spelling.',
          });
        }
      }
    }

    // SecureCare spelling — also when intake/facts mention SecureCare
    const secureInRecord =
      /securecare/i.test(parties.map((p) => p.name).join(' ')) ||
      /securecare/i.test(
        [input.caseDetails ?? '', ...(caseRecord.facts ?? []).map((f) => f.proposition)].join(' '),
      );
    if (/securcare/i.test(draftText) && secureInRecord) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH,
        severity: 'blocker',
        message: 'Draft uses "SecurCare" while CaseRecord / intake uses "SecureCare".',
        repairHint: 'Use consistent SecureCare spelling throughout.',
      });
    }

    if (isConsumer) {
      if (/\b(petitioner|respondents?)\b/i.test(draftText) && !/\bcomplainant\b/i.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY,
          severity: 'blocker',
          message:
            'Consumer matter / research memo uses Petitioner/Respondent without Complainant terminology.',
          repairHint: 'Use Complainant and Opposite Party for consumer forums.',
        });
      } else if (
        /\b(plaintiff|defendant)\b/i.test(draftText) &&
        !/\b(complainant|opposite\s+part)/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY,
          severity: 'blocker',
          message:
            'Consumer matter should prefer Complainant / Opposite Party (not Plaintiff/Defendant alone).',
          repairHint: 'Use Complainant and Opposite Party terminology.',
        });
      }
    }

    const isFamily =
      isFamilyMatrimonialKind(documentKind ?? '') ||
      /family|matrimonial|divorce|custody/i.test(caseRecord.jurisdiction?.courtName ?? '');
    if (isFamily) {
      if (/\b(plaintiff|defendants?)\b/i.test(draftText) && !/\bpetitioner\b/i.test(draftText)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY,
          severity: 'blocker',
          message: 'Family petition uses Plaintiff/Defendant instead of Petitioner/Respondent.',
          repairHint: 'Use Petitioner and Respondent for Family Court matrimonial petitions.',
        });
      } else if (
        /\b(plaintiff|defendants?)\b/i.test(draftText) &&
        /\bpetitioner\b/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY,
          severity: 'warning',
          message: 'Family petition mixes Plaintiff/Defendant with Petitioner/Respondent labels.',
          repairHint: 'Use Petitioner and Respondent consistently throughout.',
        });
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}
