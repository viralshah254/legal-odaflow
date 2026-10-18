import type { DraftIntentBundleItem } from './draft-intent-bundles';

/**
 * Map natural-language document phrases to India curated draft kinds.
 * Longer / more specific patterns should be listed first within each entry's patterns.
 */
const DOCUMENT_PHRASE_MAP: Array<{
  kind: string;
  documentKind: string;
  label: string;
  patterns: RegExp[];
}> = [
  {
    kind: 'india_legal_research_memo',
    documentKind: 'legal_research_memo',
    label: 'Legal Research Memorandum',
    patterns: [
      /\blegal\s+research\s+memorandum\b/i,
      /\bresearch\s+memorandum\b/i,
      /\bresearch\s+memo\b/i,
      /\blegal\s+research\b/i,
    ],
  },
  {
    kind: 'india_case_strategy_memo',
    documentKind: 'case_strategy_memo',
    label: 'Case Strategy Memo',
    patterns: [
      /\bcase\s+strategy\b/i,
      /\bstrategy\s+(?:memo|memorandum)\b/i,
      /\bsupporting\s+and\s+adverse\s+authorit/i,
      /\badverse[- ]?authorit/i,
    ],
  },
  {
    kind: 'india_interim_application_document_production',
    documentKind: 'interim_application_document_production',
    label: 'Interim Application — Preservation & Production',
    patterns: [
      /\binterim\s+application\b[\s\S]{0,80}\b(?:preservation|production|medical\s+records?|audit\s+logs?|electronic\s+records?|discovery)\b/i,
      /\b(?:preservation|production)\b[\s\S]{0,60}\b(?:medical\s+records?|documents?|electronic\s+records?|audit\s+logs?)\b/i,
      /\bapplication\b[\s\S]{0,40}\b(?:preserve|produce)\b[\s\S]{0,40}\b(?:records?|documents?)\b/i,
      /\bdocument\s+production\b/i,
      /\bdiscovery\s+application\b/i,
    ],
  },
  {
    kind: 'india_consumer_complaint',
    documentKind: 'consumer_complaint',
    label: 'Consumer Complaint',
    patterns: [/\bconsumer\s+complaint\b/i, /\bcomplaint\s+seeking\s+compensation\b/i],
  },
  {
    kind: 'india_application_temp_injunction',
    documentKind: 'injunction_application',
    label: 'Interim Injunction Application',
    patterns: [
      /\b(?:temporary|interim)\s+injunction\b/i,
      /\binjunction\s+application\b/i,
    ],
  },
  {
    kind: 'india_legal_notice',
    documentKind: 'legal_notice',
    label: 'Legal Notice',
    patterns: [/\blegal\s+notice\b/i],
  },
  {
    kind: 'india_suit_recovery_cpc_37',
    documentKind: 'summary_suit_recovery',
    label: 'Commercial Summary Suit for Recovery under Order XXXVII CPC',
    patterns: [
      /\border\s*(?:xxxvii|37)\b/i,
      /\bsummary\s+suit(?:\s+for\s+recovery)?\b/i,
    ],
  },
  {
    kind: 'india_civil_suit_money_recovery',
    documentKind: 'money_recovery_suit',
    label: 'Commercial Money Recovery Suit',
    patterns: [/\b(?:commercial|money)\s+recovery\s+suit\b/i],
  },
  {
    kind: 'india_civil_plaint',
    documentKind: 'civil_plaint',
    label: 'Civil Suit / Plaint',
    patterns: [
      /\bcivil\s+suit\b/i,
      /\bcivil\s+plaint\b/i,
      /\bplaint\b/i,
      /\bsuit\s+for\s+(?:recovery|damages|declaration)\b/i,
    ],
  },
  {
    kind: 'india_suit_specific_performance',
    documentKind: 'specific_performance_suit',
    label: 'Suit for Specific Performance',
    patterns: [/\bspecific\s+performance\b/i],
  },
  {
    kind: 'india_fir_complaint',
    documentKind: 'police_complaint',
    label: 'Police Complaint Seeking Registration of FIR',
    patterns: [/\bfir\b/i, /\bpolice\s+complaint\b/i],
  },
  {
    kind: 'india_complaint_magistrate_bnss_223',
    documentKind: 'criminal_complaint',
    label: 'Private Criminal Complaint before the Jurisdictional Magistrate',
    patterns: [/\bcomplaint\s+to\s+(?:the\s+)?magistrate\b/i, /\bprivate\s+complaint\b/i],
  },
  {
    kind: 'india_divorce_petition_s13',
    documentKind: 'divorce_petition',
    label: 'Divorce Petition (HMA §13)',
    patterns: [/\bdivorce\s+petition\b/i, /\bpetition\s+for\s+divorce\b/i],
  },
  {
    kind: 'india_written_statement',
    documentKind: 'written_statement_matrimonial',
    label: 'Written Statement',
    patterns: [/\bwritten\s+statement\b/i],
  },
  {
    kind: 'india_maintenance_application_bnss_144',
    documentKind: 'maintenance_application',
    label: 'Maintenance Application (BNSS §144)',
    patterns: [/\bmaintenance\s+application\b/i, /\binterim\s+maintenance\b/i],
  },
  {
    kind: 'india_regular_bail_bnss_480',
    documentKind: 'bail_application',
    label: 'Regular Bail Application',
    patterns: [/\bregular\s+bail\b/i, /\bbail\s+application\b/i],
  },
  {
    kind: 'india_anticipatory_bail_bnss_482',
    documentKind: 'bail_application',
    label: 'Anticipatory Bail Application',
    patterns: [/\banticipatory\s+bail\b/i],
  },
  {
    kind: 'india_discharge_application_bnss_250',
    documentKind: 'discharge_application',
    label: 'Discharge Application (BNSS §250)',
    patterns: [/\bdischarge\s+application\b/i],
  },
  {
    kind: 'india_writ_petition_hc',
    documentKind: 'writ_petition',
    label: 'Writ Petition (High Court)',
    patterns: [/\bwrit\s+petition\b/i],
  },
  {
    kind: 'india_cheque_bounce_complaint_ni138',
    documentKind: 'cheque_bounce_complaint',
    label: 'Cheque Bounce Complaint',
    patterns: [/\bcheque\s+bounce\b/i, /\bni\s*act\s*§?\s*138\b/i, /\bsection\s+138\b/i],
  },
];

const REQUEST_SECTION_HEADER =
  /(?:^|\n)\s*(?:drafting\s+request|prepare|draft|documents?\s+required|i\s+need|please\s+(?:prepare|draft)|documents?\s+to\s+(?:prepare|draft))\s*:?\s*/gi;

const LIST_ITEM_LINE =
  /(?:^|\n)\s*(?:(?:\d{1,2})[.)]\s*|[-*•]\s+)(.+?)(?=(?:\n\s*(?:\d{1,2}[.)]|[-*•])\s+)|\n\s*\n|$)/gi;

const EXPLICIT_REASON = 'Explicitly requested in drafting instructions';

export function mapPhraseToDraftKind(
  phrase: string,
): { kind: string; documentKind: string; label: string } | undefined {
  const cleaned = phrase
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 3) return undefined;

  for (const entry of DOCUMENT_PHRASE_MAP) {
    if (entry.patterns.some((re) => re.test(cleaned))) {
      return {
        kind: entry.kind,
        documentKind: entry.documentKind,
        label: entry.label,
      };
    }
  }
  return undefined;
}

/** Extract candidate document phrases from an explicit request section or list. */
export function extractExplicitDocumentPhrases(query: string): string[] {
  const text = query.trim();
  if (!text) return [];

  const phrases: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const p = raw
      .replace(/\s+/g, ' ')
      .replace(/[.;]+$/g, '')
      .trim();
    if (!p || p.length < 3) return;
    // Skip section headers / narrative noise that slipped in
    if (
      /^(?:parties|facts?|jurisdiction|evidence|defences?|issues?|limitation|financial|hospital|insurance|surgery)\b/i.test(
        p,
      )
    ) {
      return;
    }
    const key = p.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    phrases.push(p);
  };

  // Prefer phrases under drafting-request style headers
  const headerMatches = [...text.matchAll(REQUEST_SECTION_HEADER)];
  if (headerMatches.length > 0) {
    for (const hm of headerMatches) {
      const start = (hm.index ?? 0) + hm[0].length;
      // Take until next major section header or ~2500 chars
      const rest = text.slice(start);
      const sectionEnd = rest.search(
        /\n\s*(?:Parties|Facts|Jurisdiction|Evidence|Defences?|Issues|Background|Surgery|Competing|Missing|Hospital Liability|Insurance|Financial|Limitation|Drafting Instructions|Expected)\b/i,
      );
      const section =
        sectionEnd >= 0 ? rest.slice(0, sectionEnd) : rest.slice(0, 2500);

      // Numbered / bulleted items in section
      const items = [...section.matchAll(LIST_ITEM_LINE)];
      if (items.length >= 1) {
        for (const item of items) {
          push(item[1]);
        }
        continue;
      }

      // Inline: "a legal research memorandum; a consumer complaint; and an interim application…"
      const inlineParts = section
        .split(/\s*(?:,|;|\band\b)\s+/i)
        .map((s) => s.replace(/^(?:prepare|draft)\s+/i, '').trim())
        .filter(Boolean);
      for (const part of inlineParts) {
        // Only keep short-ish doc phrases, not long narrative
        if (part.length <= 180) push(part);
      }
    }
  }

  // Also catch top-level numbered "Prepare" style without relying solely on header slice
  if (phrases.length < 2) {
    const prepareBlock = text.match(
      /(?:prepare|draft)\s*:?\s*((?:\n\s*(?:\d{1,2}[.)]|[-*•])\s*.+){2,})/i,
    );
    if (prepareBlock?.[1]) {
      for (const item of prepareBlock[1].matchAll(LIST_ITEM_LINE)) {
        push(item[1]);
      }
    }
  }

  return phrases;
}

/**
 * When the user enumerates ≥2 known document types, return a filing-set bundle.
 * Returns undefined when fewer than 2 kinds map (playbook path remains).
 */
export function resolveExplicitDocumentBundle(
  query: string,
): DraftIntentBundleItem[] | undefined {
  const phrases = extractExplicitDocumentPhrases(query);
  if (phrases.length === 0) return undefined;

  const items: DraftIntentBundleItem[] = [];
  const seenKinds = new Set<string>();

  for (const phrase of phrases) {
    const mapped = mapPhraseToDraftKind(phrase);
    if (!mapped) continue;
    if (seenKinds.has(mapped.kind)) continue;
    seenKinds.add(mapped.kind);
    items.push({
      kind: mapped.kind,
      label: mapped.label,
      documentKind: mapped.documentKind,
      order: items.length + 1,
      selectedByDefault: true,
      defaultReason: EXPLICIT_REASON,
    });
  }

  if (items.length < 2) return undefined;
  return items;
}
