/** Shared document-kind helpers for sync and unified drafting paths. */

export function isResearchMemoKind(kind: string): boolean {
  return /research_memo|case_strategy|legal_research/i.test(kind);
}

/** Route generic research memo to consumer variant when intake has medical/consumer signals. */
export function resolveBundleResearchMemoKind(kind: string, caseDetails: string): string {
  if (kind !== 'india_legal_research_memo') return kind;
  if (hasConsumerMatterSignals(kind, caseDetails)) {
    return 'india_consumer_research_memo';
  }
  return kind;
}

/** Detect consumer / medical-negligence matter from kind or intake narrative. */
/** Family Court matrimonial petitions (divorce, custody, etc.). */
export function isFamilyMatrimonialKind(kind: string): boolean {
  return /divorce|custody|guardianship|restitution_of_conjugal|judicial_separation|family_matrimonial/i.test(
    kind,
  );
}

export function hasConsumerMatterSignals(kind: string, caseDetails?: string): boolean {
  if (/consumer|medical_negligence|document_production/i.test(kind)) return true;
  const text = caseDetails ?? '';
  return /\b(consumer\s+commission|consumer\s+protection|deficiency\s+in\s+service|opposite\s+part(?:y|ies)|medical\s+negligence|informed\s+consent|gallbladder|cholecystectomy)\b/i.test(
    text,
  );
}

export function resolveResearchMemoAccuracyMode(opts: {
  documentKind: string;
  caseDetails?: string;
  confirmedCaseRecord?: unknown;
  filingGrade?: boolean;
  explicitMode?: 'fast' | 'balanced' | 'strict';
}): 'fast' | 'balanced' | 'strict' {
  if (opts.explicitMode === 'fast' || opts.explicitMode === 'strict') {
    return opts.explicitMode;
  }
  if (opts.filingGrade) return 'balanced';
  if (
    opts.confirmedCaseRecord ||
    hasConsumerMatterSignals(opts.documentKind, opts.caseDetails) ||
    isResearchMemoKind(opts.documentKind)
  ) {
    return 'balanced';
  }
  return 'fast';
}
