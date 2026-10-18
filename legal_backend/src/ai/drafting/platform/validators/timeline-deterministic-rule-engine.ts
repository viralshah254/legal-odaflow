import { Injectable } from '@nestjs/common';
import type { CaseRecord, ChronologyEvent } from '../../contracts/case-record';
import type { GateFinding } from '../../contracts/release-gate';
import { flattenDraftText, type StructuredDraft } from '../../contracts/structured-draft';

const VERIFIER = 'timeline-deterministic-v1';

/** Parse loose date strings to sortable timestamps when possible. */
function toSortKey(date?: string): number | null {
  if (!date) return null;
  const iso = Date.parse(date);
  if (!Number.isNaN(iso)) return iso;
  const m = date.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (!m) return null;
  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };
  const mon = months[m[2].toLowerCase()];
  if (mon == null) return null;
  return Date.UTC(Number(m[3]), mon, Number(m[1]));
}

/**
 * Universal chronology validator — no bail-specific assumptions.
 * Bail post-chargesheet phrase checks live in RegularBailAdapter.
 */
@Injectable()
export class TimelineDeterministicRuleEngine {
  readonly version = VERIFIER;

  evaluate(record: CaseRecord, draft?: StructuredDraft | string): GateFinding[] {
    const findings: GateFinding[] = [];
    findings.push(...this.checkOrdering(record.chronology));

    const text =
      typeof draft === 'string'
        ? draft
        : draft
          ? flattenDraftText(draft)
          : '';

    if (text) {
      findings.push(...this.checkDraftDateMentions(record, text));
    }
    return findings;
  }

  private checkOrdering(events: ChronologyEvent[]): GateFinding[] {
    const dated = events
      .map((e) => ({ e, key: toSortKey(e.date) }))
      .filter((x): x is { e: ChronologyEvent; key: number } => x.key != null)
      .sort((a, b) => a.key - b.key);

    const findings: GateFinding[] = [];
    // Compare declared narrative order vs chronological order by label sequence in array
    for (let i = 0; i < events.length - 1; i++) {
      const a = toSortKey(events[i].date);
      const b = toSortKey(events[i + 1].date);
      if (a != null && b != null && a > b) {
        findings.push({
          id: `chronology:order:${events[i].id}:${events[i + 1].id}`,
          checkId: 'chronology',
          severity: 'blocker',
          message: `Chronology out of order: ${events[i].label} (${events[i].date}) is after ${events[i + 1].label} (${events[i + 1].date})`,
          evidence: [events[i].id, events[i + 1].id],
          repairHint: 'Correct event dates or reorder chronology',
        });
      }
    }

    // Also ensure FIR before arrest before chargesheet when all present
    const byLabel = new Map(dated.map((d) => [d.e.label.toLowerCase(), d]));
    const fir = byLabel.get('fir');
    const arrest = byLabel.get('arrest');
    const cs = byLabel.get('chargesheet');
    if (fir && arrest && fir.key > arrest.key) {
      findings.push({
        id: 'chronology:fir_after_arrest',
        checkId: 'chronology',
        severity: 'blocker',
        message: 'FIR date is after arrest date',
        evidence: [fir.e.id, arrest.e.id],
      });
    }
    if (arrest && cs && arrest.key > cs.key) {
      findings.push({
        id: 'chronology:arrest_after_chargesheet',
        checkId: 'chronology',
        severity: 'blocker',
        message: 'Arrest date is after chargesheet date',
        evidence: [arrest.e.id, cs.e.id],
      });
    }
    return findings;
  }

  private checkDraftDateMentions(record: CaseRecord, draft: string): GateFinding[] {
    const findings: GateFinding[] = [];
    for (const evt of record.chronology) {
      if (!evt.date) continue;
      const day = evt.date.match(/\d{1,2}/)?.[0];
      if (!day) continue;
      // Flag wrong day near the same event label
      const re = new RegExp(`${evt.label}[^.\\n]{0,60}?(\\d{1,2})\\s+\\w+\\s+\\d{4}`, 'i');
      const m = draft.match(re);
      if (m && m[1] !== day) {
        findings.push({
          id: `chronology:draft_date_mismatch:${evt.id}`,
          checkId: 'chronology',
          severity: 'blocker',
          message: `Draft ${evt.label} date day ${m[1]} does not match Case Record (${evt.date})`,
          evidence: [evt.id],
        });
      }
    }
    return findings;
  }
}
