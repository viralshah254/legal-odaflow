import { Injectable } from '@nestjs/common';
import type { CaseRecord, ChronologyEvent, MoneyRecord } from '../contracts/case-record';
import type {
  DraftRepairConfirmationAnswer,
  DraftRepairConfirmationQuestion,
} from './draft-repair.types';

export interface ApplyRepairConfirmationsResult {
  caseRecord: CaseRecord;
  appliedFields: string[];
  versionBumped: boolean;
}

/**
 * Builds and applies user confirmation answers during automated repair.
 * After confirmation, CaseRecord version is incremented so re-audit uses the new SoT.
 */
@Injectable()
export class DraftRepairConfirmationService {
  buildQuestionsFromConflicts(
    existing: DraftRepairConfirmationQuestion[],
  ): DraftRepairConfirmationQuestion[] {
    // Deduplicate by findingCode+field
    const seen = new Set<string>();
    const out: DraftRepairConfirmationQuestion[] = [];
    for (const q of existing) {
      const key = `${q.findingCode}|${q.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }

  applyAnswers(
    caseRecord: CaseRecord,
    answers: DraftRepairConfirmationAnswer[],
  ): ApplyRepairConfirmationsResult {
    if (!answers.length) {
      return { caseRecord, appliedFields: [], versionBumped: false };
    }

    const next: CaseRecord = {
      ...caseRecord,
      chronology: [...(caseRecord.chronology ?? [])],
      moneyRecords: [...(caseRecord.moneyRecords ?? [])],
      parties: [...(caseRecord.parties ?? [])],
      facts: [...(caseRecord.facts ?? [])],
      jurisdiction: { ...caseRecord.jurisdiction },
      contradictions: [...(caseRecord.contradictions ?? [])],
      metadata: {
        ...caseRecord.metadata,
        version: caseRecord.metadata.version + 1,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      },
    };

    const appliedFields: string[] = [];

    for (const answer of answers) {
      const value = answer.value;
      if (value == null || value === '') continue;

      if (answer.field === 'date' || /date/i.test(answer.field)) {
        const dateStr = String(value);
        // Prefer updating matching chronology entry; else append confirmation event
        const matchIdx = next.chronology.findIndex((e) =>
          answer.findingCode
            ? true
            : e.date === dateStr || e.label.toLowerCase().includes(answer.field),
        );
        if (matchIdx >= 0) {
          const updated: ChronologyEvent = {
            ...next.chronology[matchIdx],
            date: dateStr,
            datePrecision: 'exact',
          };
          next.chronology[matchIdx] = updated;
        } else {
          next.chronology.push({
            id: `conf_date_${Date.now()}`,
            label: answer.field,
            date: dateStr,
            datePrecision: 'exact',
            factIds: [],
            sourceHierarchy: 'user_confirmed_edit',
          });
        }
        appliedFields.push(answer.field);
      } else if (answer.field === 'amount' || /amount|fee|valuation/i.test(answer.field)) {
        const label = String(value);
        const moneyIdx = next.moneyRecords?.findIndex((m) =>
          m.description.toLowerCase().includes(answer.field.toLowerCase()),
        );
        if (moneyIdx != null && moneyIdx >= 0 && next.moneyRecords) {
          const updated: MoneyRecord = {
            ...next.moneyRecords[moneyIdx],
            amountLabel: label,
            confirmationState: 'user_confirmed',
            disputed: false,
          };
          next.moneyRecords[moneyIdx] = updated;
        } else {
          next.moneyRecords = [
            ...(next.moneyRecords ?? []),
            {
              id: `conf_money_${Date.now()}`,
              kind: 'claim',
              amountLabel: label,
              description: answer.field,
              confirmationState: 'user_confirmed',
            },
          ];
        }
        appliedFields.push(answer.field);
      } else if (answer.field === 'forum' || /forum|court/i.test(answer.field)) {
        next.jurisdiction = {
          ...next.jurisdiction,
          courtName: String(value),
        };
        appliedFields.push(answer.field);
      } else {
        // Generic: store as a confirmed fact
        next.facts = [
          ...next.facts,
          {
            id: `conf_fact_${Date.now()}_${appliedFields.length}`,
            proposition: `${answer.field}: ${String(value)}`,
            sourceQuote: String(value),
            sourceType: 'user_input',
            sourceHierarchy: 'user_confirmed_edit',
            status: 'admitted',
            confidence: 'explicit',
            userApproved: true,
          },
        ];
        appliedFields.push(answer.field);
      }

      // Resolve contradictions that match the answered field
      next.contradictions = next.contradictions.map((c) => {
        if (c.resolution) return c;
        if (c.field && c.field !== answer.field && !answer.field.includes(c.field)) {
          return c;
        }
        return {
          ...c,
          resolution: {
            chosenFactId: c.factId1,
            resolvedByUserId: 'user_confirmation',
            resolvedAt: new Date().toISOString(),
            note: `Confirmed ${answer.field}=${String(value)}`,
          },
        };
      });
    }

    return {
      caseRecord: next,
      appliedFields,
      versionBumped: appliedFields.length > 0,
    };
  }
}
