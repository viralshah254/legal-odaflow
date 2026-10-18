import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'timeline-semantic-v1';

/**
 * Semantic / paraphrased procedural contradiction auditor.
 * Universal — no bail-only hardcoded rules. Uses Case Record chronology + stage signals.
 */
@Injectable()
export class TimelineSemanticContradictionAuditor {
  readonly version = VERIFIER;

  evaluate(record: CaseRecord, draft?: StructuredDraft | string): GateFinding[] {
    const text =
      typeof draft === 'string'
        ? draft
        : draft
          ? flattenDraftText(draft)
          : '';
    if (!text) return [];

    const findings: GateFinding[] = [];
    const hasChargesheet = record.chronology.some((e) =>
      /chargesheet/i.test(e.label),
    );
    const stage = (record.matterData as { proceduralStage?: string } | undefined)
      ?.proceduralStage;

    if (hasChargesheet || stage === 'post_chargesheet') {
      // Generic stale-investigation language (document-agnostic)
      if (
        /\binvestigation\s+(?:is\s+)?(?:still\s+)?(?:ongoing|pending|at\s+a\s+nascent\s+stage)\b/i.test(
          text,
        )
      ) {
        findings.push({
          id: 'semantic:stale_investigation_post_filing',
          checkId: 'chronology',
          severity: 'blocker',
          message:
            'Draft asserts investigation still pending/ongoing after Case Record shows chargesheet chronology event',
          evidence: record.chronology.filter((e) => /chargesheet/i.test(e.label)).map((e) => e.id),
          repairHint: 'Align procedural posture with Case Record chronology',
        });
      }
    }

    // Party-date inversion heuristics
    const firEvt = record.chronology.find((e) => /fir/i.test(e.label));
    if (firEvt?.date) {
      const wrongDayPatterns = this.wrongDayNearKeyword(text, 'FIR', firEvt.date);
      findings.push(...wrongDayPatterns);
    }

    return findings;
  }

  private wrongDayNearKeyword(
    draft: string,
    keyword: string,
    correctDate: string,
  ): GateFinding[] {
    const correctDay = correctDate.match(/\d{1,2}/)?.[0];
    if (!correctDay) return [];
    const findings: GateFinding[] = [];
    const re = new RegExp(`${keyword}[^.\\n]{0,80}?(\\d{1,2})\\s+(\\w+)\\s+(\\d{4})`, 'gi');
    for (const m of draft.matchAll(re)) {
      if (m[1] !== correctDay) {
        findings.push({
          id: `semantic:wrong_${keyword.toLowerCase()}_day`,
          checkId: 'chronology',
          severity: 'blocker',
          message: `${keyword} date in draft (${m[1]} ${m[2]} ${m[3]}) conflicts with Case Record (${correctDate})`,
        });
      }
    }
    return findings;
  }
}
