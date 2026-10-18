import { Injectable } from '@nestjs/common';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

/**
 * Maps bare case-name citations to required nearby proposition language.
 * Deterministic heuristics only — full passage verification remains elsewhere.
 */
@Injectable()
export class CitationPropositionValidatorService {
  readonly version = 'citation-proposition-v1';

  evaluate(input: { draftText: string; documentKind?: string }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { draftText, documentKind } = input;
    const isResearchMemo = /research_memo|case_strategy|legal_research/i.test(documentKind ?? '');

    const caseCites = [
      ...draftText.matchAll(
        /\b([A-Z][A-Za-z.&'\-]+(?:\s+[A-Z][A-Za-z.&'\-]+){0,6}\s+v\.?\s+[A-Z][A-Za-z.&'\-]+(?:\s+[A-Z][A-Za-z.&'\-]+){0,6})\b/g,
      ),
    ];

    for (const m of caseCites.slice(0, 20)) {
      const cite = m[1];
      const idx = m.index ?? 0;
      const window = draftText.slice(Math.max(0, idx - 120), idx + cite.length + 180);
      const hasProposition =
        /\b(held|holding|ratio|proposition|principle|laid\s+down|observed|relying\s+on|supports?)\b/i.test(
          window,
        ) || /\(\d{4}\)/.test(window);
      if (!hasProposition) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.CITATION_WITHOUT_PROPOSITION,
          severity: 'warning',
          message: `Citation "${cite}" appears without a linked legal proposition.`,
          repairHint: 'State the exact proposition the authority is cited for.',
        });
      }
    }

    if (
      !isResearchMemo &&
      /\b(guarantees?\s+success|court\s+will\s+certainly|inevitable\s+relief)\b/i.test(
        draftText,
      )
    ) {
      findings.push({
        code: ACCURACY_BLOCKER_CODES.PRAYER_EXCEEDS_LEGAL_TEST,
        severity: 'blocker',
        message: 'Draft guarantees outcome beyond what authorities support.',
        repairHint: 'Remove outcome guarantees; plead relief as sought.',
      });
    }

    return { findings, passed: auditPassed(findings) };
  }
}
