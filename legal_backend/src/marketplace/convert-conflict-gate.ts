export type ConvertConflictCheck = {
  clear: boolean;
  matchCount?: number;
  matches?: unknown[];
  summary?: string;
};

export function shouldBlockConvertOnConflict(
  check: ConvertConflictCheck | null | undefined,
  overrideConflict: boolean,
): boolean {
  if (!check) return false;
  return !check.clear && !overrideConflict;
}

export function conflictStatusFromCheck(
  check: ConvertConflictCheck | null | undefined,
): 'CLEAR' | 'REVIEW_REQUIRED' | 'SKIPPED' {
  if (!check) return 'SKIPPED';
  return check.clear ? 'CLEAR' : 'REVIEW_REQUIRED';
}
