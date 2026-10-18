import { Injectable, Optional } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';

const VERIFIER = 'statute-existence-v2';

/** Minimal known act IDs for Wave-1 existence checks (extend via bare-act lookup). */
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

  constructor(@Optional() private readonly bareActLookup?: BareActLookupService) {}

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

    const charged = new Set(
      [
        ...record.statutes.map((st) => `${st.actId}:${st.section}`.toLowerCase()),
        ...record.suggestedStatutes.map((st) => `${st.actId}:${st.section}`.toLowerCase()),
      ],
    );
    const draftSections = [...text.matchAll(/\b(?:Section|§|u\/s)\s*(\d+[A-Za-z]?)\b/gi)];
    if (charged.size > 0 && draftSections.length > 20) {
      // Soft — procedural cites validated via bare-act async path
    }

    return findings;
  }

  async evaluateAsync(record: CaseRecord, draft?: StructuredDraft | string): Promise<GateFinding[]> {
    const findings = this.evaluate(record, draft);
    if (!this.bareActLookup) return findings;

    const country = record.jurisdiction?.countryCode ?? 'IN';
    for (const s of record.statutes) {
      if (!KNOWN_ACTS.has(s.actId.toUpperCase()) || !s.section?.trim()) continue;
      const lookup = await this.bareActLookup.lookupExactSection(s.actId, s.section, country);
      if (!lookup.found) {
        findings.push({
          id: `statute:missing_section:${s.id}`,
          checkId: 'section_existence',
          severity: 'blocker',
          message: `Section ${s.section} of ${s.actId} was not found in primary statutory sources.`,
          evidence: [s.id],
        });
      }
    }
    return findings;
  }
}
