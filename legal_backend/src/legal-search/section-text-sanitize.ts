/**
 * Detect and strip schedule / fee-table content that bleeds into section bodies
 * during PDF extraction (common in Court Fees Act and similar bare acts).
 */

/** Patterns where embedded schedule or tabular content begins. */
const SCHEDULE_TABLE_BOUNDARIES: RegExp[] = [
  /\n\s*THE COURT-FEES ACT,?\s*1870\s+\d+\s*\n/i,
  /(?:^|[\s.])THE COURT-FEES ACT,?\s*1870\s+\d+/i,
  /\nTable of Rates of ad valorem Fees/i,
  /Table of Rates of ad valorem Fees/i,
  /\nWhen the amount or value of[\s\S]{0,120}?Proper fee/i,
  /When the amount or value of[\s\S]{0,120}?Proper fee/i,
  /\nNumber\s+Proper fee\s*\n/i,
  /Number\s+Proper fee/i,
  /\nSCHEDULE\s+[IVXLC\d]+/i,
  /\nFirst Schedule\b/i,
  /\nSecond Schedule\b/i,
  /\nThird Schedule\b/i,
];

const INLINE_PAGE_HEADER = /(?:^|\n)\s*THE COURT-FEES ACT,?\s*1870\s+\d+\s*(?:\n|$)/gi;

/** Index of the earliest schedule/table boundary, or text.length if none. */
export function findScheduleTableBoundary(text: string): number {
  let earliest = text.length;
  for (const pattern of SCHEDULE_TABLE_BOUNDARIES) {
    const match = text.match(pattern);
    if (match?.index !== undefined && match.index < earliest) {
      earliest = match.index;
    }
  }
  return earliest;
}

/** Remove schedule/table overflow and repeated page headers from section body text. */
export function stripEmbeddedSchedulesAndTables(text: string): string {
  const boundary = findScheduleTableBoundary(text);
  const truncated = boundary < text.length ? text.slice(0, boundary) : text;
  return truncated.replace(INLINE_PAGE_HEADER, '\n').trim();
}

/** True when text is mostly fee-table rows rather than statutory prose. */
export function isPrimarilyTableOrScheduleText(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;

  if (
    /Table of Rates|Proper fee|subject-matter exceeds.*But does not exceed|Rs\. Rs\. Rs\. A\. P/i.test(
      normalized,
    )
  ) {
    return true;
  }

  const feeRowMatches = normalized.match(
    /\d[\d,.\s]{0,24}\d\s+\d\s+\d/g,
  );
  if (feeRowMatches && feeRowMatches.length >= 8) {
    return true;
  }

  const digits = (normalized.match(/\d/g) ?? []).length;
  if (normalized.length > 200 && digits / normalized.length > 0.35) {
    return true;
  }

  return false;
}
