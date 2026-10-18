/** Human-readable labels for universal accuracy / release-gate blocker codes. */
export const ACCURACY_BLOCKER_LABELS: Record<string, string> = {
  PARTY_NAME_CORRUPTED: "Fact mismatch — party name corrupted",
  MATERIAL_PARTY_OMITTED: "Fact mismatch — material party omitted",
  ENTITY_NAME_MISMATCH: "Fact mismatch — entity name spelling",
  PARTY_ROLE_INCONSISTENT: "Wrong party terminology / role",
  PARTY_NUMBERING_INCONSISTENT: "Party numbering inconsistent",
  WRONG_PARTY_TERMINOLOGY: "Wrong party terminology",
  KNOWN_VALUE_LEFT_BLANK: "Known fact omitted (left blank)",
  UNSUPPORTED_MATERIAL_FACT: "Liability overstated / unsupported fact",
  DISPUTED_FACT_STATED_AS_ADMITTED: "Disputed fact stated as admitted",
  DATE_CORRUPTION: "Fact mismatch — date",
  AMOUNT_CORRUPTION: "Fact mismatch — amount",
  PROCEDURE_CORRUPTION: "Fact mismatch — procedure",
  FACTUAL_EVENT_SUBSTITUTION: "Fact mismatch — event substitution",
  EXPERT_OPINION_STATED_AS_FACT: "Liability overstated — expert as fact",
  WRONG_SECTION: "Wrong section",
  WRONG_SUBSECTION: "Wrong subsection",
  STALE_STATUTE: "Wrong section — stale statute",
  STATUTE_NOT_RELEVANT: "Wrong section — not relevant",
  WRONG_FORUM: "Wrong forum",
  PECUNIARY_BASIS_UNSUPPORTED: "Wrong forum — pecuniary basis",
  TERRITORIAL_BASIS_UNSUPPORTED: "Wrong forum — territorial basis",
  SUBJECT_MATTER_JURISDICTION_WRONG: "Wrong forum — subject-matter",
  STATE_RULE_CONFIRMATION_REQUIRED: "Court fee needs confirmation",
  MISSING_REQUIRED_SECTION: "Annexure / section missing",
  MISSING_ANNEXURE_LIST: "Annexure missing",
  LIMITATION_NOT_ANALYSED: "Limitation needs review",
  VALUATION_BASIS_WRONG: "Court fee / valuation needs confirmation",
  COURT_FEE_BASIS_WRONG: "Court fee needs confirmation",
  RELIEF_TEST_NOT_PLEADED: "Prayer unsupported",
  PRAYER_EXCEEDS_LEGAL_TEST: "Prayer unsupported",
  MATERIAL_ADVERSE_FACT_OMITTED: "Adverse fact omitted",
  MATERIAL_ADVERSE_AUTHORITY_OMITTED: "Adverse fact omitted — authority",
  INVENTED_INSURER_DENIAL: "Liability overstated — invented insurer denial",
  CITATION_WITHOUT_PROPOSITION: "Citation without proposition",
  DOCUMENT_STATUS_MISSTATED: "Liability overstated — record integrity",
}

export function labelForAccuracyBlocker(codeOrMessage: string): string {
  const codeMatch = codeOrMessage.match(/\b([A-Z][A-Z0-9_]{4,})\b/)
  const code = codeMatch?.[1]
  if (code && ACCURACY_BLOCKER_LABELS[code]) {
    return ACCURACY_BLOCKER_LABELS[code]
  }
  if (/Accuracy:\s*\[([A-Z0-9_]+)\]/i.test(codeOrMessage)) {
    const c = codeOrMessage.match(/Accuracy:\s*\[([A-Z0-9_]+)\]/i)?.[1]
    if (c && ACCURACY_BLOCKER_LABELS[c]) return ACCURACY_BLOCKER_LABELS[c]
  }
  return codeOrMessage
}
