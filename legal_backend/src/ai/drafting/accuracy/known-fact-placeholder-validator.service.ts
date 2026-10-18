import { Injectable } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import {
  ACCURACY_BLOCKER_CODES,
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';

const BLANK_RE =
  /\[BLANK(?::[^\]]*)?\]|_{3,}|\bTBD\b|\bto be filled\b/gi;

@Injectable()
export class KnownFactPlaceholderValidatorService {
  readonly version = 'known-fact-blank-v1';

  evaluate(input: {
    caseRecord: CaseRecord;
    draftText: string;
  }): AccuracyAuditResult {
    const findings: AccuracyFinding[] = [];
    const { caseRecord, draftText } = input;
    const blanks = [...draftText.matchAll(BLANK_RE)];
    if (blanks.length === 0) {
      return { findings, passed: true };
    }

    const knownValues: Array<{ label: string; value: string }> = [];
    for (const p of caseRecord.parties ?? []) {
      if (p.name?.trim()) knownValues.push({ label: `party:${p.role}`, value: p.name.trim() });
    }
    for (const e of caseRecord.chronology ?? []) {
      if (e.date?.trim()) {
        knownValues.push({ label: e.label || 'chronology', value: e.date.trim() });
      }
    }
    for (const f of caseRecord.facts ?? []) {
      // Extract simple dates and rupee amounts from propositions
      const dates = f.proposition.match(
        /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
      );
      for (const d of dates ?? []) {
        knownValues.push({ label: 'fact-date', value: d });
      }
      const amounts = f.proposition.match(/₹\s*[\d,]+(?:\.\d+)?|\bRs\.?\s*[\d,]+/gi);
      for (const a of amounts ?? []) {
        knownValues.push({ label: 'fact-amount', value: a });
      }
    }
    for (const m of caseRecord.moneyRecords ?? []) {
      if (m.amountLabel?.trim()) {
        knownValues.push({ label: `money:${m.kind}`, value: m.amountLabel.trim() });
      }
    }

    // If draft has blanks AND we have known chronology/party values that are
    // missing from the filled draft text near blank contexts, flag.
    for (const kv of knownValues) {
      const normalized = kv.value.replace(/\s+/g, ' ').trim();
      if (normalized.length < 4) continue;
      if (!draftText.includes(normalized) && !draftText.toLowerCase().includes(normalized.toLowerCase())) {
        // Known value entirely absent while blanks exist → likely left blank
        findings.push({
          code: ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
          severity: 'blocker',
          message: `Known CaseRecord value "${normalized}" (${kv.label}) is missing while the draft still contains blanks.`,
          repairHint: 'Fill the blank from CaseRecord or omit the clause.',
        });
      }
    }

    // Blank placeholders that explicitly name known fields
    for (const m of blanks) {
      const token = m[0].toLowerCase();
      if (
        /date|surgery|consent|amount|address|hospital|doctor|age|name|compensation|expense/.test(
          token,
        )
      ) {
        findings.push({
          code: ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
          severity: 'blocker',
          message: `Draft contains labeled blank "${m[0]}" that should be filled from CaseRecord when available.`,
          repairHint: 'Replace with CaseRecord chronology, party, or money value.',
        });
      }
    }

    // Dedupe by message
    const seen = new Set<string>();
    const deduped = findings.filter((f) => {
      if (seen.has(f.message)) return false;
      seen.add(f.message);
      return true;
    });

    return { findings: deduped, passed: auditPassed(deduped) };
  }
}
