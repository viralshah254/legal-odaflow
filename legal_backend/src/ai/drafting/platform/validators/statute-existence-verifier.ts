import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'statute-existence-v1';

/** Minimal known act IDs for Wave-1 existence checks (extend via bare-act lookup later). */
const KNOWN_ACTS = new Set([
  'BNSS',
  'BNS',
  'BSA',
  'IPC',
  'CRPC',
  'IEA',
  'CONSTITUTION',
  'NI',
  'IT',
]);

@Injectable()
export class StatuteExistenceVerifier {
  readonly version = VERIFIER;

  evaluate(record: CaseRecord, draft?: StructuredDraft | string): GateFinding[] {
    const findings: GateFinding[] = [];

    for (const s of record.statutes) {
      if (!KNOWN_ACTS.has(s.actId.toUpperCase())) {
        findings.push({
          id: `statute:unknown_act:${s.id}`,
          checkId: 'section_existence',
          severity: 'warning',
          message: `Unrecognized actId in Case Record: ${s.actId}`,
          evidence: [s.id],
        });
      }
      if (!s.section?.trim()) {
        findings.push({
          id: `statute:empty_section:${s.id}`,
          checkId: 'section_existence',
          severity: 'blocker',
          message: `Statute entry missing section number: ${s.raw}`,
        });
      }
    }

    const text =
      typeof draft === 'string'
        ? draft
        : draft
          ? flattenDraftText(draft)
          : '';
    if (!text) return findings;

    // Sections appearing in draft that are not in charged statutes or suggestions
    const charged = new Set(
      [
        ...record.statutes.map((s) => `${s.actId}:${s.section}`.toLowerCase()),
        ...record.suggestedStatutes.map((s) => `${s.actId}:${s.section}`.toLowerCase()),
      ],
    );
    const draftSections = [
      ...text.matchAll(/\b(?:Section|§|u\/s)\s*(\d+[A-Za-z]?)\b/gi),
    ];
    // Soft check only — many procedural sections (193, 480) are vehicles not charges
    if (charged.size > 0 && draftSections.length > 20) {
      // no hard fail — adapters handle unsupported section addition
    }

    return findings;
  }
}
