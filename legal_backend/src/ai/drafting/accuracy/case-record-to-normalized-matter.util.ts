import type { CaseRecord, CaseFact, ChronologyEvent, FactStatus } from '../contracts/case-record';
import { isRenderableFact } from '../contracts/case-record';
import type { FactItem, NormalizedMatter } from '@/ai/unified-drafting/contracts/normalized-matter';

function mapCaseFactStatus(status: FactStatus): FactItem['status'] {
  switch (status) {
    case 'prosecution_allegation':
      return 'alleged';
    case 'defence_version':
      return 'disputed';
    case 'disputed':
      return 'disputed';
    case 'admitted':
    case 'procedural_record':
      return 'confirmed';
    default:
      return 'uncertain';
  }
}

function chronologyToFact(event: ChronologyEvent): FactItem {
  const statement = event.date
    ? `${event.label} (${event.date})`
    : event.label;
  return {
    id: event.id,
    statement,
    status: 'confirmed',
    source: 'court_record',
    date: event.date,
  };
}

function caseFactToFactItem(fact: CaseFact): FactItem {
  return {
    id: fact.id,
    statement: fact.proposition,
    status: mapCaseFactStatus(fact.status),
    source: 'court_record',
    sourceReference: fact.sourceQuote?.slice(0, 120),
    date: undefined,
  };
}

function isMaterialFact(fact: CaseFact): boolean {
  if (fact.materiality === 'background') return false;
  if (fact.materiality === 'critical' || fact.materiality === 'important') return true;
  // When materiality not assigned, include non-background statuses
  return fact.status !== 'procedural_record' || /\b(consent|bile|expert|record|surgery|injury)\b/i.test(fact.proposition);
}

/**
 * Merge confirmed CaseRecord facts into NormalizedMatter, replacing sparse LLM facts.
 * Chronology events become primary timeline facts; material CaseRecord propositions are appended.
 */
export function mergeCaseRecordIntoNormalizedMatter(
  matter: NormalizedMatter,
  caseRecord: CaseRecord,
): NormalizedMatter {
  const chronologyFacts = (caseRecord.chronology ?? []).map(chronologyToFact);
  const materialFacts = (caseRecord.facts ?? [])
    .filter(isRenderableFact)
    .filter(isMaterialFact)
    .map(caseFactToFactItem);

  const seen = new Set<string>();
  const mergedFacts: FactItem[] = [];
  for (const f of [...chronologyFacts, ...materialFacts]) {
    const key = f.statement.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    mergedFacts.push(f);
  }

  if (mergedFacts.length === 0) {
    return matter;
  }

  const parties =
    matter.parties.length > 0
      ? matter.parties
      : (caseRecord.parties ?? []).map((p) => ({
          role: mapPartyRole(p.role),
          name: p.name,
          description: p.description,
        }));

  const contradictions = (caseRecord.contradictions ?? []).map((c) => ({
    factId1: c.factId1,
    factId2: c.factId2,
    description: c.description,
  }));

  return {
    ...matter,
    parties,
    facts: mergedFacts,
    contradictions: contradictions.length > 0 ? contradictions : matter.contradictions,
    caseRecordBacked: true,
  };
}

function mapPartyRole(role: string): NormalizedMatter['parties'][0]['role'] {
  const r = role.toLowerCase();
  if (/complainant|petitioner|plaintiff|applicant/.test(r)) return 'petitioner';
  if (/opposite|respondent|defendant|accused/.test(r)) return 'respondent';
  if (/hospital|insurer|doctor|surgeon|anaesthesiologist/.test(r)) return 'other';
  return 'other';
}

/** Build a dedicated FACTS prompt block from CaseRecord for section generation. */
export function buildCaseRecordFactsBlock(caseRecord: CaseRecord): string {
  const chronology = (caseRecord.chronology ?? [])
    .map((e) => `  • ${e.label}: ${e.date ?? '[date unknown]'}`)
    .join('\n');
  const facts = (caseRecord.facts ?? [])
    .filter(isRenderableFact)
    .filter((f) => f.materiality !== 'background')
    .map((f) => `  • [${f.status}] ${f.proposition}`)
    .join('\n');
  const contradictions = (caseRecord.contradictions ?? [])
    .map((c) => `  • ${c.description}`)
    .join('\n');
  const evidence = (caseRecord.evidence ?? [])
    .map((e) => `  • ${e.type}: ${e.description}`)
    .join('\n');

  return [
    'CASE RECORD FACTS (primary source — prefer over Case Brief and raw narrative):',
    chronology ? `CHRONOLOGY:\n${chronology}` : '',
    facts ? `MATERIAL FACTS:\n${facts}` : '',
    contradictions ? `CONTRADICTIONS / RECORD CONFLICTS:\n${contradictions}` : '',
    evidence ? `EVIDENCE:\n${evidence}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
