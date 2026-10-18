/** Sibling ICA sections for contracting-out / mandatory-vs-default research. */
export const CONTRACT_ACT_WAIVER_SIBLING_SECTIONS = [
  '23',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '62',
  '63',
  '74',
] as const;

/** Targeted case-law queries when live IK fails on waiver / s.23 questions. */
export const CONTRACT_ACT_WAIVER_CASE_QUERIES = [
  '"section 23" "Indian Contract Act" Supreme Court',
  '"section 28" arbitration "Indian Contract Act"',
  '"section 74" penalty "Indian Contract Act"',
  '"section 27" restraint of trade "Indian Contract Act"',
  'contract out statutory protection "Indian Contract Act"',
] as const;

export function isContractActWaiverQuery(query: string): boolean {
  const q = query.toLowerCase();
  const mentionsContractAct =
    /\b(?:indian\s+)?contract\s+act\b/i.test(query) || /\bica\b/i.test(q);
  const waiverTheme =
    /\b(waiver|waive|contract\s*out|contracting\s*out|mandatory|default\s+rule|colourable|colorable|circumvent|bypass|unenforceable|invalidate)\b/i.test(
      q,
    ) || /\bsection\s*23\b/i.test(q);
  return mentionsContractAct && waiverTheme;
}

export function isProvisionTaxonomyQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    isContractActWaiverQuery(query) ||
    (/\b(mandatory|default\s+rule|non-waivable|modifiable|contract\s*out)\b/i.test(q) &&
      /\b(statute|section|provision|act)\b/i.test(q))
  );
}
