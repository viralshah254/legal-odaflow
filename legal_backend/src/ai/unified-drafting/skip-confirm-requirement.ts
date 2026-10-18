import { isConfirmedCaseRecord } from '@/ai/drafting/accuracy/case-record-prompt.util';

/**
 * Filing-grade drafts must not auto-confirm the Case Record.
 * Skip the confirm requirement only when the UI already sent a confirmed record,
 * or the kind is not filing-grade.
 */
export function resolveSkipConfirmRequirement(
  filingGrade: boolean,
  confirmedRecord: unknown,
): boolean {
  if (!filingGrade) return true;
  return isConfirmedCaseRecord(confirmedRecord);
}
