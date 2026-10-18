/**
 * Rule Engine — Limitation Period Calculator
 *
 * Deterministic limitation period computation using article-accurate lookup.
 * Extends the static `court-deadlines.service.ts` table with:
 *   - Accrual-date awareness (cause of action date, not matter creation date)
 *   - India Limitation Act 1963 article references
 *   - Condonation notes where applicable
 *   - Filing deadline computation
 *
 * No LLM calls — fully deterministic.
 */

import { Injectable } from '@nestjs/common';
import type { LimitationPeriodResult } from '../drafting-v2.types';

interface LimitationEntry {
  days: number;
  rule: string;
  articleRef?: string;
  condonationNotes?: string;
}

/** India Limitation Act 1963 — selected articles covering common disputes */
const INDIA_LIMITATION_ARTICLES: Record<string, LimitationEntry> = {
  contract: { days: 1095, rule: 'Limitation Act 1963 Art.55 (breach of contract — 3yr from breach)', articleRef: 'Art.55' },
  money_suit: { days: 1095, rule: 'Limitation Act 1963 Art.22 (money suit — 3yr)', articleRef: 'Art.22' },
  cheque_dishonour: { days: 30, rule: 'NI Act s.142 — complaint within 30 days of cause of action arising', articleRef: 'NI Act s.142' },
  maintenance_revision: { days: 90, rule: 'BNSS §474 read with Limitation Act — revision within 90 days of order', articleRef: 'BNSS §474', condonationNotes: 'Delay condonable with sufficient cause under BNSS §479' },
  appeal_civil: { days: 90, rule: 'Limitation Act 1963 Art.116 (first appeal to HC — 90 days)', articleRef: 'Art.116', condonationNotes: 'Delay condonable under s.5 Limitation Act with sufficient cause' },
  appeal_criminal: { days: 60, rule: 'BNSS 2023 §417 (appeal to Sessions — 60 days)', articleRef: 'BNSS §417', condonationNotes: 'Delay condonable for sufficient cause' },
  writ_petition: { days: -1, rule: 'No fixed limitation for writ petition; laches principle applies', condonationNotes: 'Court may refuse writ if filed after unreasonable delay' },
  property_adverse_possession: { days: 4380, rule: 'Limitation Act 1963 Art.65 (adverse possession — 12yr)', articleRef: 'Art.65' },
  probate: { days: 365, rule: 'Indian Succession Act 1925 Art.137 (1yr from death)', articleRef: 'Art.137' },
  tort: { days: 1095, rule: 'Limitation Act 1963 Art.74-75 (tort — 3yr)', articleRef: 'Art.74-75' },
  bail: { days: -1, rule: 'No limitation applicable to bail applications' },
  injunction: { days: 1095, rule: 'Limitation Act 1963 Art.55/58 (injunction suit — 3yr)', articleRef: 'Art.55/58' },
};

const MULTI_JURISDICTION_TABLE: Record<string, Record<string, LimitationEntry>> = {
  litigation_disputes: {
    IN: INDIA_LIMITATION_ARTICLES.contract,
    GB: { days: 2190, rule: 'Limitation Act 1980 s.2 (contract/tort 6yr)' },
    US: { days: 1460, rule: 'Varies by state; typically 4yr contract (CA), 3yr tort' },
    KE: { days: 2190, rule: 'Limitation of Actions Act Cap 22 s.4 (6yr)' },
  },
  employment_labour: {
    IN: { days: 365, rule: 'Industrial Disputes Act s.10A (1yr)' },
    GB: { days: 91, rule: 'Employment Rights Act 1996 s.111 (3 months less 1 day)' },
    US: { days: 300, rule: 'Title VII / ADA — 300 days to EEOC' },
    KE: { days: 1095, rule: 'Employment Act 2007 (3yr)' },
  },
  criminal_defense: {
    IN: INDIA_LIMITATION_ARTICLES.appeal_criminal,
    GB: { days: 182, rule: "Magistrates' Courts Act 1980 s.127 (6 months summary offences)" },
    US: { days: 1825, rule: 'Federal: 5yr general SOL (18 USC 3282)' },
    KE: { days: 365, rule: 'Criminal Procedure Code (varies by offence)' },
  },
};

function kindToCategory(kind: string): string {
  if (/maintenance.*revision|revision.*maintenance/i.test(kind)) return 'maintenance_revision';
  if (/cheque|ni_act|138/i.test(kind)) return 'cheque_dishonour';
  if (/bail/i.test(kind)) return 'bail';
  if (/writ/i.test(kind)) return 'writ_petition';
  if (/appeal.*civil|civil.*appeal/i.test(kind)) return 'appeal_civil';
  if (/appeal.*criminal|criminal.*appeal/i.test(kind)) return 'appeal_criminal';
  if (/probate|succession/i.test(kind)) return 'probate';
  if (/property|possession/i.test(kind)) return 'property_adverse_possession';
  if (/tort|negligence/i.test(kind)) return 'tort';
  if (/contract|agreement|breach/i.test(kind)) return 'contract';
  if (/injunction/i.test(kind)) return 'injunction';
  return 'contract'; // safe fallback
}

@Injectable()
export class LimitationEngineService {
  compute(
    documentKind: string,
    countryCode: string,
    practiceArea: string,
    accrualDateStr?: string,
  ): LimitationPeriodResult {
    const category = kindToCategory(documentKind);
    const country = countryCode.toUpperCase();

    const entry =
      INDIA_LIMITATION_ARTICLES[category] ??
      MULTI_JURISDICTION_TABLE[practiceArea]?.[country];

    if (!entry) {
      return {
        applicable: false,
        notes: [`No limitation rule found for kind=${documentKind} country=${country}`],
      };
    }

    if (entry.days === -1) {
      return {
        applicable: false,
        notes: [entry.rule, ...(entry.condonationNotes ? [entry.condonationNotes] : [])],
      };
    }

    let deadlineDate: string | undefined;
    let withinLimitation: boolean | undefined;

    if (accrualDateStr) {
      const accrualDate = new Date(accrualDateStr);
      if (!isNaN(accrualDate.getTime())) {
        const deadline = new Date(accrualDate);
        deadline.setDate(deadline.getDate() + entry.days);
        deadlineDate = deadline.toISOString().split('T')[0];
        withinLimitation = new Date() <= deadline;
      }
    }

    return {
      applicable: true,
      periodDays: entry.days,
      rule: entry.rule,
      accrualDate: accrualDateStr,
      deadlineDate,
      withinLimitation,
      notes: [
        entry.articleRef ? `Limitation Act reference: ${entry.articleRef}` : '',
        entry.condonationNotes ?? '',
      ].filter(Boolean),
    };
  }
}
