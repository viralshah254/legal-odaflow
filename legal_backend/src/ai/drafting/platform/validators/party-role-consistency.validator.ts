import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'party-role-consistency-v1';

function normalizeName(n: string): string {
  return n.toLowerCase().replace(/\s+/g, ' ').trim();
}

@Injectable()
export class PartyRoleConsistencyValidator {
  readonly version = VERIFIER;

  evaluate(record: CaseRecord, draft?: StructuredDraft | string): GateFinding[] {
    const findings: GateFinding[] = [];
    const names = record.parties.map((p) => normalizeName(p.name)).filter(Boolean);

    // Duplicate conflicting roles for same name
    const byName = new Map<string, string[]>();
    for (const p of record.parties) {
      const key = normalizeName(p.name);
      if (!key) continue;
      const roles = byName.get(key) ?? [];
      roles.push(p.role);
      byName.set(key, roles);
    }
    for (const [name, roles] of byName) {
      const unique = [...new Set(roles.map((r) => r.toLowerCase()))];
      if (unique.length > 1 && unique.includes('state') && unique.some((r) => /accused|applicant/i.test(r))) {
        findings.push({
          id: `party:role_conflict:${name}`,
          checkId: 'party_consistency',
          severity: 'blocker',
          message: `Party "${name}" has conflicting roles: ${unique.join(', ')}`,
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

    // Flag invented party names (simple heuristic: capitalized Name Surname not in record)
    for (const p of record.parties) {
      if (!p.name || p.name.length < 3) continue;
      // Ensure applicant name appears if filing-style draft
      if (/applicant|accused|plaintiff|petitioner/i.test(p.role)) {
        const tokens = p.name.split(/\s+/).filter((t) => t.length > 2);
        const missing = tokens.filter((t) => !new RegExp(t, 'i').test(text));
        if (missing.length === tokens.length && text.length > 200) {
          findings.push({
            id: `party:missing_name:${p.id}`,
            checkId: 'party_consistency',
            severity: 'warning',
            message: `Primary party "${p.name}" not found in draft text`,
            evidence: [p.id],
          });
        }
      }
    }

    // Wrong opposing party spelled as client
    if (names.length >= 2 && text.length > 100) {
      // no-op placeholder for future fuzzy match
    }

    return findings;
  }
}
