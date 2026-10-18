import { Injectable } from '@nestjs/common';

export interface StatuteVersionNote {
  /** Codes/regimes detected in the query that have version sensitivity. */
  detected: string[];
  /** Prompt guidance describing version/applicability rules. */
  promptBlock: string;
  /** True when the query mixes or risks confusing old and new code references. */
  oldVsNewRisk: boolean;
}

/**
 * India old-vs-new criminal code transitions. Used to warn about applicability by
 * date and procedural posture and to prevent silent substitution of section numbers.
 */
const INDIA_CODE_TRANSITIONS: Array<{
  oldCode: RegExp;
  oldName: string;
  newName: string;
  commenced: string;
}> = [
  { oldCode: /\bIPC\b|indian penal code/i, oldName: 'IPC, 1860', newName: 'Bharatiya Nyaya Sanhita, 2023 (BNS)', commenced: '1 July 2024' },
  { oldCode: /\bCrPC\b|code of criminal procedure/i, oldName: 'CrPC, 1973', newName: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)', commenced: '1 July 2024' },
  { oldCode: /\bevidence act\b|indian evidence act/i, oldName: 'Indian Evidence Act, 1872', newName: 'Bharatiya Sakshya Adhiniyam, 2023 (BSA)', commenced: '1 July 2024' },
];

const INDIA_NEW_CODES = /\bBNS\b|\bBNSS\b|\bBSA\b|bharatiya (nyaya|nagarik|sakshya)/i;

/**
 * Reports statutory version/applicability guidance so the model does not silently
 * substitute old and new code sections, and verifies tax/regulatory currency.
 */
@Injectable()
export class StatuteVersionCheckerService {
  check(params: { query: string; countryCode?: string | null }): StatuteVersionNote {
    const detected: string[] = [];
    const lines: string[] = ['STATUTORY VERSION CHECK:'];
    let oldVsNewRisk = false;

    const isIndia = (params.countryCode ?? '').toUpperCase() === 'IN';
    const query = params.query ?? '';

    if (isIndia) {
      const mentionsOld = INDIA_CODE_TRANSITIONS.filter((t) => t.oldCode.test(query));
      const mentionsNew = INDIA_NEW_CODES.test(query);

      for (const t of mentionsOld) {
        detected.push(t.oldName);
        lines.push(
          `  - ${t.oldName} → ${t.newName} (commenced ${t.commenced}). Confirm which applies based on the date of the offence/cause of action and procedural posture; do not auto-substitute section numbers.`,
        );
      }

      if (mentionsNew) {
        detected.push('BNS/BNSS/BSA (2023)');
        lines.push(
          '  - New codes (BNS/BNSS/BSA, 2023) apply to matters from their commencement; older facts/proceedings may still be governed by IPC/CrPC/Evidence Act under transitional provisions. State the applicable code expressly.',
        );
      }

      if (mentionsOld.length > 0 && mentionsNew) {
        oldVsNewRisk = true;
        lines.push(
          '  - The query references both old and new codes: keep section numbers and code names consistent and explain applicability; never equate an old section number with a new one without confirmation.',
        );
      }

      if (/\b(GST|income[-\s]?tax|customs|excise|tax)\b/i.test(query)) {
        detected.push('Tax (version-sensitive)');
        lines.push(
          '  - Tax law is version-sensitive: confirm the tax period, the statute version in force for that period, applicable notifications/circulars, and current rates from official/current sources.',
        );
      }
    } else {
      lines.push(
        '  - Confirm the in-force version of any statute cited (amendments, commencement, repeal, transitional provisions) against official sources for this jurisdiction.',
      );
    }

    if (lines.length === 1) {
      // Nothing version-specific detected — provide a minimal default.
      lines.push(
        '  - Confirm any statute cited is the in-force version (check amendments/commencement/repeal) before reliance.',
      );
    }

    return {
      detected,
      promptBlock: lines.join('\n'),
      oldVsNewRisk,
    };
  }
}
