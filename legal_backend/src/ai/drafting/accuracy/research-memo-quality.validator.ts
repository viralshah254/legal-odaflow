import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';
import { splitDraftSections, wordCount } from './pleading-completeness-validator.service';

const SHORT_ANSWER_MAX_WORDS = 400;

/** Fact coverage patterns for medical-negligence research memos. */
const MEDICAL_FACT_PATTERNS: Array<{ key: string; re: RegExp; label: string }> = [
  { key: 'surgery', re: /\b(?:surgery|laparoscopic|cholecystectomy|11\s+March)\b/i, label: 'surgery timeline' },
  { key: 'bile_duct', re: /\b(?:bile[\s-]?duct|bile\s+leak)\b/i, label: 'bile-duct injury / leak' },
  { key: 'expert_evidence', re: /\b(?:expert|medical\s+board|probable|recognised\s+complication)\b/i, label: 'competing expert evidence' },
  { key: 'record_inconsistencies', re: /\b(?:record|PDF|version|conflict|does\s+not\s+appear)\b/i, label: 'record inconsistencies' },
  { key: 'consent', re: /\bconsent\b/i, label: 'consent anomalies' },
];

@Injectable()
export class ResearchMemoQualityValidatorService {
  readonly version = 'research-memo-quality-v1';

  evaluate(input: {
    draftText: string;
    documentKind?: string;
    caseRecord?: CaseRecord;
    caseDetails?: string;
    requiredSections?: string[];
    consumerMatterSignals?: boolean;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const isResearchMemo = /research_memo|case_strategy|legal_research/i.test(
      input.documentKind ?? '',
    );
    if (!isResearchMemo) return { findings, passed: true };

    const slices = splitDraftSections(input.draftText);
    const shortAnswer = slices.find((s) => /short\s*answer/i.test(s.title));
    if (shortAnswer) {
      const words = wordCount(shortAnswer.body);
      const hasAnalysisSubsections = /\b(?:liability|jurisdiction|maintainability|grounds)\b/i.test(
        shortAnswer.body,
      );
      if (words > SHORT_ANSWER_MAX_WORDS || (words > 200 && hasAnalysisSubsections)) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY,
          severity: 'blocker',
          message: `SHORT ANSWER is bloated (${words} words) or contains full ANALYSIS subsections — regenerate as executive summary.`,
          sectionHint: 'SHORT ANSWER',
          repairHint:
            'Write a qualified executive summary under 400 words; move detailed analysis to ANALYSIS section.',
          metadata: { wordCount: words },
        });
      }
    }

    const required =
      input.requiredSections ??
      ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'];
    for (const section of ['AUTHORITIES', 'NEXT STEPS']) {
      if (!required.includes(section)) continue;
      const slice = slices.find((s) => sectionMatchesRequired(s.title, section));
      if (!slice || wordCount(slice.body) < 15) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.MISSING_REQUIRED_SECTION,
          severity: 'blocker',
          message: `Research memo requires substantive "${section}" section.`,
          sectionHint: section,
          repairHint: `Regenerate ${section} from verified authorities and practical next steps.`,
        });
      }
    }

    const isMedicalConsumer =
      input.consumerMatterSignals ||
      /consumer.*research|medical/i.test(input.documentKind ?? '') ||
      /\b(medical|negligence|hospital|consent|surgery|bile)\b/i.test(
        `${input.caseDetails ?? ''}\n${(input.caseRecord?.facts ?? []).map((f) => f.proposition).join('\n')}`,
      );

    if (isMedicalConsumer) {
      const factsHay = [
        input.draftText,
        ...slices
          .filter((s) => /facts|analysis/i.test(s.title))
          .map((s) => s.body),
      ].join('\n');

      for (const pat of MEDICAL_FACT_PATTERNS) {
        const inIntake =
          pat.re.test(input.caseDetails ?? '') ||
          (input.caseRecord?.facts ?? []).some((f) => pat.re.test(f.proposition)) ||
          (input.caseRecord?.chronology ?? []).some((e) => pat.re.test(`${e.label} ${e.date ?? ''}`));
        if (inIntake && !pat.re.test(factsHay)) {
          findings.push({
            code: ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
            severity: 'blocker',
            message: `Material intake fact omitted from FACTS/ANALYSIS: ${pat.label}.`,
            repairHint: `Include ${pat.label} from CaseRecord in FACTS and ANALYSIS.`,
            metadata: { requiredFact: pat.key },
          });
        }
      }
    }

    return { findings, passed: auditPassed(findings) };
  }
}

function sectionMatchesRequired(title: string, required: string): boolean {
  const t = title.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const r = required.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return t.includes(r) || r.includes(t);
}

export { MEDICAL_FACT_PATTERNS };
