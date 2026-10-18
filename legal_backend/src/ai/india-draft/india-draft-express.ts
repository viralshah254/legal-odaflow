/** Pre-litigation correspondence — skip case-law retrieval and two-pass enrichment. */
export function isExpressIndiaDraftKind(kind: string): boolean {
  return /legal_notice|demand_letter|reply_to_notice|cease_and_desist|notice_reply/i.test(
    kind,
  );
}
