import { Injectable } from '@nestjs/common';
import {
  SOURCE_HIERARCHY_RANK,
  type CaseContradiction,
  type CaseFact,
  type CaseRecord,
  type SourceHierarchyLevel,
} from '../contracts/case-record';
import type { GateFinding } from '../contracts/release-gate';

const BLOCKER_FIELDS = new Set([
  'court',
  'parties',
  'charges',
  'dates',
  'stage',
  'custody',
  'remedy',
  'fir_date',
  'arrest_date',
  'party_name',
]);

/**
 * Universal source-conflict resolver.
 * Model never picks the "correct" version — unresolved blocker conflicts block generation.
 */
@Injectable()
export class SourceConflictResolver {
  evaluate(record: CaseRecord): {
    findings: GateFinding[];
    unresolvedBlockers: CaseContradiction[];
    suggestions: Array<{
      contradictionId: string;
      preferredFactId: string;
      reason: string;
    }>;
  } {
    const findings: GateFinding[] = [];
    const suggestions: Array<{
      contradictionId: string;
      preferredFactId: string;
      reason: string;
    }> = [];

    const dateConflicts = this.detectDateConflicts(record.facts);
    for (const c of dateConflicts) {
      record.contradictions.push(c);
    }

    const unresolvedBlockers: CaseContradiction[] = [];

    for (const c of record.contradictions) {
      if (c.resolution) continue;
      const severity =
        c.severity === 'blocker' ||
        (c.field && BLOCKER_FIELDS.has(c.field)) ||
        /date|party|charge|custody|court|stage/i.test(c.description)
          ? 'blocker'
          : c.severity;

      const fact1 = record.facts.find((f) => f.id === c.factId1);
      const fact2 = record.facts.find((f) => f.id === c.factId2);
      const preferred = this.preferByHierarchy(fact1, fact2);
      if (preferred) {
        suggestions.push({
          contradictionId: c.id,
          preferredFactId: preferred.id,
          reason: `Higher source hierarchy (${preferred.sourceHierarchy ?? 'unknown'})`,
        });
      }

      if (severity === 'blocker') {
        unresolvedBlockers.push({ ...c, severity: 'blocker' });
        findings.push({
          id: `conflict:${c.id}`,
          checkId: 'source_conflicts',
          severity: 'blocker',
          message: `Unresolved critical conflict: ${c.description}`,
          evidence: [c.factId1, c.factId2],
          repairHint: 'User must resolve this conflict before generation',
        });
      } else {
        findings.push({
          id: `conflict:${c.id}`,
          checkId: 'source_conflicts',
          severity: 'warning',
          message: c.description,
          evidence: [c.factId1, c.factId2],
        });
      }
    }

    return { findings, unresolvedBlockers, suggestions };
  }

  hasBlockingConflicts(record: CaseRecord): boolean {
    return this.evaluate(record).unresolvedBlockers.length > 0;
  }

  private preferByHierarchy(
    a?: CaseFact,
    b?: CaseFact,
  ): CaseFact | undefined {
    if (!a && !b) return undefined;
    if (!a) return b;
    if (!b) return a;
    const ra = SOURCE_HIERARCHY_RANK[(a.sourceHierarchy ?? 'narrative') as SourceHierarchyLevel] ?? 0;
    const rb = SOURCE_HIERARCHY_RANK[(b.sourceHierarchy ?? 'narrative') as SourceHierarchyLevel] ?? 0;
    if (ra === rb) return undefined;
    return ra > rb ? a : b;
  }

  private detectDateConflicts(facts: CaseFact[]): CaseContradiction[] {
    const firFacts = facts.filter((f) => /\bFIR\b/i.test(f.proposition) && /\d/.test(f.proposition));
    const out: CaseContradiction[] = [];
    for (let i = 0; i < firFacts.length; i++) {
      for (let j = i + 1; j < firFacts.length; j++) {
        const d1 = firFacts[i].proposition.match(/\d{1,2}/)?.[0];
        const d2 = firFacts[j].proposition.match(/\d{1,2}/)?.[0];
        if (d1 && d2 && d1 !== d2) {
          out.push({
            id: `CONTRA_DATE_${firFacts[i].id}_${firFacts[j].id}`,
            factId1: firFacts[i].id,
            factId2: firFacts[j].id,
            field: 'fir_date',
            description: `Conflicting FIR dates: "${firFacts[i].proposition}" vs "${firFacts[j].proposition}"`,
            severity: 'blocker',
          });
        }
      }
    }
    return out;
  }
}
