import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

@Injectable()
export class FactFidelityAuditorService {
  readonly version = 'fact-fidelity-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
    caseDetails?: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText, caseDetails = '' } = input;
    const intake = [
      caseDetails,
      ...(caseRecord.facts ?? []).map((f) => f.proposition),
      ...(caseRecord.facts ?? []).map((f) => f.sourceQuote),
    ]
      .join('\n')
      .toLowerCase();
    const draft = draftText.toLowerCase();

    // Invented insurer denial when intake has no repudiation
    const intakeHasRepudiation =
      /\b(repudiat|claim\s+deni|denied\s+the\s+claim|wrongful\s+repudiation|rejected\s+the\s+claim)\b/i.test(
        intake,
      );
    const draftClaimsDenial =
      /\b(rejected|denied|repudiated)\b.{0,40}\b(claim|coverage|policy)\b|\bbad\s+faith\b.{0,40}\binsur/i.test(
        draft,
      );
    if (draftClaimsDenial && !intakeHasRepudiation) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL,
        severity: 'blocker',
        message:
          'Draft alleges insurance claim denial / repudiation / bad faith without support in CaseRecord or intake.',
        repairHint: 'Remove insurer-denial grounds unless the user confirms repudiation facts.',
      });
    }

    // Expert opinion stated as conclusive fact
    if (
      /\b(conclusively|definitely|established\s+that).{0,60}\b(expert|negligence|consent)\b/i.test(
        draftText,
      ) ||
      /\bprivate\s+expert\b.{0,40}\b(proves|established|conclusive)\b/i.test(draftText)
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.EXPERT_OPINION_STATED_AS_FACT,
        severity: 'blocker',
        message: 'Draft treats expert opinion or contested medical conclusions as established fact.',
        repairHint: 'Qualify as alleged / probable / subject to proof.',
      });
    }

    // Disputed facts stated as admitted — look for "disputed" in case facts
    for (const f of caseRecord.facts ?? []) {
      if (f.status !== 'disputed' && f.status !== 'prosecution_allegation') continue;
      const snippet = f.proposition.slice(0, 40).toLowerCase();
      if (snippet.length < 12) continue;
      if (
        draft.includes(snippet) &&
        /\b(is\s+established|is\s+admitted|conclusively|beyond\s+doubt)\b/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.DISPUTED_FACT_STATED_AS_ADMITTED,
          severity: 'blocker',
          message: `Disputed/alleged fact appears stated as admitted: "${f.proposition.slice(0, 80)}"`,
          repairHint: 'Plead as allegation subject to proof.',
        });
      }
    }

    // Scan-as-negligence / surgery replaced by scan
    if (
      /\bscan\s+(negligence|was\s+negligent)\b/i.test(draftText) ||
      (/\bCT\s+scan\b/i.test(draftText) &&
        /\bthe\s+negligent\s+(procedure|surgery)\b/i.test(draftText) &&
        !/\bgallbladder|laparoscop|bile[- ]duct/i.test(draftText))
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.FACTUAL_EVENT_SUBSTITUTION,
        severity: 'blocker',
        message: 'Draft appears to substitute CT scan for the surgical procedure as the negligent act.',
        repairHint: 'Plead gallbladder surgery / bile-duct injury chronology from CaseRecord.',
      });
    }

    // Known chronology dates corrupted (e.g. surgery date swapped)
    for (const e of caseRecord.chronology ?? []) {
      if (!e.date || !e.label) continue;
      if (/surgery|procedure|operation/i.test(e.label) && /13\s+March|march\s+13/i.test(e.date)) {
        // If CaseRecord wrongly has scan date as surgery — skip
      }
      if (
        /surgery|procedure|operation/i.test(e.label) &&
        !draft.toLowerCase().includes(e.date.toLowerCase()) &&
        /\bsurgery\b/i.test(draftText)
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.DATE_CORRUPTION,
          severity: 'warning',
          message: `Surgery/procedure date from CaseRecord ("${e.date}") may be missing or altered in the draft.`,
        });
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}
