import type { CaseRecord } from '../contracts/case-record';

/**
 * Shared CaseRecord prompt block for sync India draft and unified section generation.
 */
export function buildCaseRecordPromptBlock(caseRecord: CaseRecord): string {
  const parties = (caseRecord.parties ?? [])
    .map((p) => `  • ${p.role}: ${p.name}`)
    .join('\n');
  const chronology = (caseRecord.chronology ?? [])
    .map((e) => `  • ${e.label}: ${e.date ?? '[unknown]'}`)
    .join('\n');
  const money = (caseRecord.moneyRecords ?? [])
    .map((m) => `  • ${m.kind}: ${m.amountLabel} — ${m.description}`)
    .join('\n');
  const facts = (caseRecord.facts ?? [])
    .filter((f) => f.materiality !== 'background')
    .map((f) => `  • [${f.status}] ${f.proposition}`)
    .join('\n');
  const contradictions = (caseRecord.contradictions ?? [])
    .map((c) => `  • ${c.description}`)
    .join('\n');
  const evidence = (caseRecord.evidence ?? [])
    .map((e) => `  • ${e.type}: ${e.description}`)
    .join('\n');
  const factLocks = (caseRecord.factLocks ?? [])
    .map(
      (lock) =>
        `  • ${lock.id} [${lock.status}]: ${JSON.stringify(lock.payload)}${
          lock.blockingIssues.length
            ? `\n    BLOCKERS: ${lock.blockingIssues.join(' | ')}`
            : ''
        }`,
    )
    .join('\n');
  if (!parties && !chronology && !money && !facts && !contradictions && !evidence && !factLocks) return '';

  const intakeHay = [
    ...(caseRecord.facts ?? []).map((f) => f.proposition),
    ...(caseRecord.facts ?? []).map((f) => f.sourceQuote),
  ].join('\n');
  const hasRepudiation =
    /\b(repudiat|claim\s+deni|denied\s+the\s+claim|wrongful\s+repudiation)\b/i.test(
      intakeHay,
    ) ||
    (/\binsurance\s+claim\b/i.test(intakeHay) &&
      !/\bno\s+insurance\s+claim\b/i.test(intakeHay));

  return [
    'CASE RECORD (source of truth — never replace known values with [BLANK]; never invent facts absent here):',
    parties ? `PARTIES:\n${parties}` : '',
    chronology ? `CHRONOLOGY:\n${chronology}` : '',
    money ? `MONEY / VALUATION:\n${money}` : '',
    facts ? `FACTS:\n${facts}` : '',
    contradictions ? `CONTRADICTIONS:\n${contradictions}` : '',
    evidence ? `EVIDENCE:\n${evidence}` : '',
    factLocks
      ? `LOCKED STRUCTURED VALUES (copy identifiers, dates, and amounts exactly; do not recalculate):\n${factLocks}`
      : '',
    (caseRecord.factLocks ?? []).some((lock) => lock.status === 'blocked')
      ? 'FILING SAFETY: A fact lock is blocked. Preserve unresolved values as descriptive [BLANK] fields and do not state a final calculated total.'
      : '',
    /consumer/i.test(caseRecord.jurisdiction?.courtName ?? '') ||
    (caseRecord.parties ?? []).some((p) => /complainant|opposite/i.test(p.role))
      ? 'PARTY TERMINOLOGY: Use Complainant and Opposite Party (not Petitioner/Respondent) for consumer forums.'
      : '',
    hasRepudiation
      ? 'INSURER: CaseRecord supports claim denial/repudiation allegations where pleaded as allegations.'
      : 'INSURER: CaseRecord does NOT support claim denial, repudiation, or bad faith — do not allege them.',
    'PROHIBITED ASSERTIONS unless CaseRecord expressly supports them: insurer claim denial/repudiation/bad faith; doctor qualifications/registration; conclusive negligence; conclusive absence of consent; conclusive forgery/tampering; unsupported causation against a named doctor.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function isConfirmedCaseRecord(
  value: unknown,
): value is CaseRecord {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { parties?: unknown }).parties) &&
    (value as { metadata?: { status?: string } }).metadata?.status === 'confirmed'
  );
}
