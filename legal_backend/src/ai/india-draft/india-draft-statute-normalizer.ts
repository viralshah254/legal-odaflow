import { findRemap } from '@/legal-search/statute-registry';
import { normalizeBnssText } from '@/ai/citations/substance-verification.service';

export type StatuteCorrectionSource = 'schedule1_crosswalk' | 'bare_act';

export interface StatuteCorrection {
  from: string;
  to: string;
  reason: string;
  source: StatuteCorrectionSource;
}

export interface StatuteNormalizeResult {
  text: string;
  corrections: StatuteCorrection[];
}

const MAINTENANCE_CONTEXT =
  /maintenance|wife|wives|husband|child|children|parent|parents|alimony|interim maintenance|crpc\s*§?\s*125|crpc\s+125|bnss\s*§?\s*144|bnss\s+144/i;

const BNSS_144_SUCCESSOR =
  'Section 144 of the Bharatiya Nagarik Suraksha Sanhita, 2023';

function isMaintenanceContext(text: string, kind?: string, caseDetails?: string): boolean {
  const haystack = `${kind ?? ''} ${caseDetails ?? ''} ${text}`;
  return MAINTENANCE_CONTEXT.test(haystack);
}

function pushCorrection(
  corrections: StatuteCorrection[],
  from: string,
  to: string,
  reason: string,
  source: StatuteCorrectionSource = 'schedule1_crosswalk',
): void {
  if (from === to) return;
  if (corrections.some((c) => c.from === from && c.to === to)) return;
  corrections.push({ from, to, reason, source });
}

/**
 * Deterministic repairs for known India draft statute errors — especially CrPC §125 → BNSS §144
 * (maintenance) and the common LLM mistake of mapping maintenance to BNS §125.
 */
export function normalizeIndiaDraftStatutes(
  text: string,
  context?: { kind?: string; caseDetails?: string },
): StatuteNormalizeResult {
  const corrections: StatuteCorrection[] = [];
  let out = text;
  const maintenance = isMaintenanceContext(out, context?.kind, context?.caseDetails);
  const crpc125Remap = findRemap('IN', 'crpc', '125');

  if (maintenance) {
    // Wrong successor: "(now Section 125 of the Bharatiya Nyaya Sanhita…)"
    const wrongBnsSuccessor =
      /\(now\s+Section\s+125\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita[^)]*\)/gi;
    if (wrongBnsSuccessor.test(out)) {
      const from = out.match(wrongBnsSuccessor)?.[0] ?? '(now Section 125 of the Bharatiya Nyaya Sanhita)';
      const to = `(now ${BNSS_144_SUCCESSOR})`;
      pushCorrection(
        corrections,
        from,
        to,
        'Maintenance moved to BNSS §144 under Schedule I — BNS §125 is an unrelated substantive offence.',
      );
      out = out.replace(wrongBnsSuccessor, to);
    }

    // BNS §125 cited for maintenance / family matters
    const bns125Maintenance = [
      /\bBNS\s*(?:§|s\.?|Section\s*)125\b[^.\n]{0,80}(?:maintenance|wife|husband|child|parent|alimony)/gi,
      /(?:maintenance|wife|husband|child|parent|alimony)[^.\n]{0,80}\bBNS\s*(?:§|s\.?|Section\s*)125\b/gi,
      /\bSection\s+125\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita[^.\n]{0,80}(?:maintenance|wife|husband|child|parent)/gi,
    ];
    for (const pattern of bns125Maintenance) {
      if (pattern.test(out)) {
        const before = out;
        out = out.replace(/\bBNS\s*(?:§|s\.?|Section\s*)125\b/gi, 'BNSS §144');
        out = out.replace(
          /\bSection\s+125\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita\b/gi,
          BNSS_144_SUCCESSOR,
        );
        if (out !== before) {
          pushCorrection(
            corrections,
            'BNS §125 (maintenance context)',
            'BNSS §144',
            'BNS §125 punishes endangering life — maintenance is BNSS §144 (formerly CrPC §125).',
          );
        }
        break;
      }
    }

    // CrPC §125 paired with wrong new code section
    const crpcWithWrongSuccessor =
      /Section\s+125\s+of\s+the\s+Code\s+of\s+Criminal\s+Procedure[^.\n]{0,120}(?:now\s+Section\s+125\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita|BNS\s*(?:§|s\.?|Section\s*)125)/gi;
    if (crpcWithWrongSuccessor.test(out)) {
      const before = out;
      out = out.replace(
        /(\(now\s+)Section\s+125\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita[^)]*(\))/gi,
        `$1${BNSS_144_SUCCESSOR}$2`,
      );
      out = out.replace(
        /(\(now\s+)BNS\s*(?:§|s\.?|Section\s*)125(\))/gi,
        `$1${BNSS_144_SUCCESSOR}$2`,
      );
      if (out !== before) {
        pushCorrection(
          corrections,
          'CrPC §125 → BNS §125 successor',
          'CrPC §125 → BNSS §144',
          crpc125Remap?.note ??
            'Schedule I crosswalk: CRPC §125 (maintenance) renumbered to BNSS §144.',
        );
      }
    }

    // Standalone wrong mapping phrases
    out = out.replace(
      /CrPC\s*(?:§|s\.?|Section\s*)125\s*(?:of|\/)?\s*(?:the\s+)?(?:Code\s+of\s+Criminal\s+Procedure[^.\n]{0,40})?\s*(?:\(now\s+)?BNS\s*(?:§|s\.?|Section\s*)125/gi,
      (match) => {
        const replacement =
          'Section 125 of the Code of Criminal Procedure, 1973 (now ' + BNSS_144_SUCCESSOR + ')';
        pushCorrection(
          corrections,
          match,
          replacement,
          'CrPC §125 maintenance successor is BNSS §144, not BNS §125.',
        );
        return replacement;
      },
    );

    // BNS §144 cited for maintenance (wrong — BNS §144 is an unrelated substantive offence)
    const isDivorce = /divorce|hma|hindu\s+marriage|india_divorce/i.test(
      `${context?.kind ?? ''} ${context?.caseDetails ?? ''}`,
    );
    const bns144Maintenance = [
      /\bBNS\s*(?:§|s\.?|Section\s*)144\b[^.\n]{0,120}(?:maintenance|wife|husband|child|parent|alimony)/gi,
      /(?:maintenance|wife|husband|child|parent|alimony)[^.\n]{0,120}\bBNS\s*(?:§|s\.?|Section\s*)144\b/gi,
      /\bSection\s+144\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita[^.\n]{0,120}(?:maintenance|wife|husband|child|parent|alimony)/gi,
    ];
    for (const pattern of bns144Maintenance) {
      if (pattern.test(out)) {
        const before = out;
        const replacement = isDivorce
          ? 'HMA §24 (pendente lite maintenance) and HMA §25 (permanent alimony)'
          : 'BNSS §144';
        out = out.replace(/\bBNS\s*(?:§|s\.?|Section\s*)144\b/gi, replacement);
        out = out.replace(
          /\bSection\s+144\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita,?\s*2023?\b/gi,
          isDivorce ? 'Sections 24 and 25 of the Hindu Marriage Act, 1955' : BNSS_144_SUCCESSOR,
        );
        if (out !== before) {
          pushCorrection(
            corrections,
            'BNS §144 (maintenance context)',
            isDivorce ? 'HMA §24/§25' : 'BNSS §144',
            'BNS §144 is an unrelated substantive offence — maintenance is BNSS §144; in divorce petitions prefer HMA §24/§25.',
          );
        }
        break;
      }
    }

    if (
      /\bBNS\s*(?:§|s\.?|Section\s*)144\b/i.test(out) ||
      /\bSection\s+144\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita/i.test(out)
    ) {
      const before = out;
      out = out.replace(/\bBNS\s*(?:§|s\.?|Section\s*)144\b/gi, isDivorce ? 'HMA §24/§25' : 'BNSS §144');
      out = out.replace(
        /\bSection\s+144\s+of\s+the\s+Bharatiya\s+Nyaya\s+Sanhita,?\s*2023?\b/gi,
        isDivorce ? 'Sections 24 and 25 of the Hindu Marriage Act, 1955' : BNSS_144_SUCCESSOR,
      );
      if (out !== before) {
        pushCorrection(
          corrections,
          'BNS §144',
          isDivorce ? 'HMA §24/§25' : 'BNSS §144',
          'BNS is substantive criminal law — not the maintenance code.',
        );
      }
    }
  }

  // Schedule I: CrPC §125 → BNSS §144 when cited as current BNSS section in maintenance docs
  if (maintenance && crpc125Remap) {
    const standaloneCrpc125AsCurrent =
      /(?:under|pursuant\s+to|in\s+terms\s+of)\s+Section\s+125\s+(?:of\s+the\s+)?(?:Code\s+of\s+Criminal\s+Procedure|Cr\.?\s*P\.?\s*C\.?)/gi;
    if (standaloneCrpc125AsCurrent.test(out) && !/now\s+Section\s+144/i.test(out)) {
      out = out.replace(
        standaloneCrpc125AsCurrent,
        (match) => {
          const replacement = `${match} (now ${BNSS_144_SUCCESSOR})`;
          pushCorrection(
            corrections,
            match,
            replacement,
            crpc125Remap.note ?? 'CRPC §125 → BNSS §144 under Schedule I.',
          );
          return replacement;
        },
      );
    }
  }

  out = normalizeBnssText(out);

  return { text: out, corrections };
}
