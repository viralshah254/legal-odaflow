import { CURATED_CONSUMER_SOURCE_BANK } from '@/ai/drafting/accuracy/curated-consumer-sources.util';
import { resolveCuratedEnrichBank, type CuratedEnrichCase } from '../enrich/curated-enrich-banks';
import type { ExtractedCitationProposition } from './draft-authority-verification.types';

const CASE_CITE_RE =
  /\(?\d{4}\)?\s*\d+\s+SCC\s+\d+|\bAIR\s+\d{4}\s+(?:SC|All|Del|Bom|Mad|Guj|Ker|P&H|Raj)\s+\d+/gi;

const CASE_NAME_RE =
  /\b([A-Z][A-Za-z.&'\-]+(?:\s+[A-Z][A-Za-z.&'\-]+){0,8}\s+v\.?\s+[A-Z][A-Za-z.&'\-]+(?:\s+[A-Z][A-Za-z.&'\-]+){0,8})\b/g;

const LEGAL_PROP_HINT =
  /\b(specific\s+performance|readiness\s+and\s+willingness|temporary\s+injunction|interim\s+injunction|permanent\s+injunction|limitation|territorial\s+jurisdiction|pecuniary\s+jurisdiction|cause\s+of\s+action|section\s+\d+[a-z]?|§\s*\d+[a-z]?|order\s+[xivlc]+|prima\s+facie|balance\s+of\s+convenience|irreparable|compensation|damages|bail|personal\s+liberty|flight\s+risk|deficiency\s+in\s+service|medical\s+negligence|consumer|prayer|relief|held|holding|ratio|principle)\b/i;

const ISSUE_PATTERNS: Array<{ issue: string; pattern: RegExp }> = [
  { issue: 'bail', pattern: /\bbail\b|personal\s+liberty|flight\s+risk|triple\s+test/i },
  { issue: 'specific_performance', pattern: /specific\s+performance/i },
  { issue: 'readiness_and_willingness', pattern: /readiness\s+and\s+willingness/i },
  { issue: 'temporary_injunction', pattern: /temporary\s+injunction|interim\s+injunction|order\s+xxxix/i },
  { issue: 'deficiency_in_service', pattern: /deficiency\s+in\s+service|consumer/i },
  { issue: 'medical_negligence', pattern: /medical\s+negligence|hospital|consent/i },
  { issue: 'limitation', pattern: /limitation|barred\s+by\s+time/i },
  { issue: 'prima_facie_case', pattern: /prima\s+facie/i },
  { issue: 'balance_of_convenience', pattern: /balance\s+of\s+convenience/i },
  { issue: 'irreparable_injury', pattern: /irreparable/i },
  { issue: 'writ_jurisdiction', pattern: /writ\s+petition|article\s+\d+/i },
  { issue: 'arbitration', pattern: /arbitration|section\s+9/i },
  { issue: 'wrongful_termination', pattern: /wrongful\s+termination|reinstatement/i },
  { issue: 'relief', pattern: /\brelief\b|\bprayer\b|\bcompensation\b/i },
];

function normalizeCite(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function allCuratedCases(documentKind: string, rawFacts: string): CuratedEnrichCase[] {
  const enrich = resolveCuratedEnrichBank(documentKind, rawFacts);
  const consumer = CURATED_CONSUMER_SOURCE_BANK.map((c) => ({
    caseId: c.id,
    citation: c.citation,
    title: c.title,
    areas: ['consumer'],
    proposition: c.summary,
    treatmentStatus: 'good_law' as const,
    court: 'Supreme Court of India',
  }));
  const seen = new Set<string>();
  const out: CuratedEnrichCase[] = [];
  for (const c of [...enrich, ...consumer]) {
    const key = normalizeCite(c.citation);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function detectIssue(text: string, documentKind: string, legalIssues: string[] = []): string {
  for (const issue of legalIssues) {
    const pattern = ISSUE_PATTERNS.find((p) => p.issue === issue)?.pattern;
    if (pattern?.test(text)) return issue;
    if (text.toLowerCase().includes(issue.replace(/_/g, ' '))) return issue;
  }
  for (const { issue, pattern } of ISSUE_PATTERNS) {
    if (pattern.test(text)) return issue;
  }
  if (legalIssues.length > 0) return legalIssues[0];
  if (/consumer|complaint|medical/i.test(documentKind)) return 'deficiency_in_service';
  if (/bail/i.test(documentKind)) return 'bail';
  if (/specific_performance|civil_plaint|property/i.test(documentKind)) return 'specific_performance';
  return 'relief';
}

function nearestProposition(draftText: string, index: number): string {
  const lineStart = draftText.lastIndexOf('\n', index);
  const lineEnd = draftText.indexOf('\n', index);
  const line = draftText
    .slice(lineStart >= 0 ? lineStart + 1 : 0, lineEnd >= 0 ? lineEnd : draftText.length)
    .replace(/\s+/g, ' ')
    .trim();
  if (line.length >= 40 && LEGAL_PROP_HINT.test(line)) {
    return line.slice(0, 500);
  }

  const start = Math.max(0, index - 600);
  const end = Math.min(draftText.length, index + 400);
  const window = draftText.slice(start, end);
  const paragraphs = window.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let best = '';
  for (const p of paragraphs) {
    if (p.length < 30) continue;
    if (LEGAL_PROP_HINT.test(p) && p.length > best.length) best = p;
  }
  if (best) return best.slice(0, 500);
  const sentence = window
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .find((s) => s.length >= 40 && LEGAL_PROP_HINT.test(s));
  return (sentence ?? window.trim()).slice(0, 500);
}

function resolveCuratedByCite(
  cite: string,
  documentKind: string,
  rawFacts: string,
): CuratedEnrichCase | undefined {
  const norm = normalizeCite(cite);
  return allCuratedCases(documentKind, rawFacts).find(
    (c) => normalizeCite(c.citation) === norm || norm.includes(normalizeCite(c.citation)),
  );
}

export function extractCitationPropositions(
  draftText: string,
  documentKind: string,
  rawFacts = '',
  evidenceIdByCitation: Map<string, string[]> = new Map(),
  legalIssues: string[] = [],
): ExtractedCitationProposition[] {
  const results: ExtractedCitationProposition[] = [];
  const seen = new Set<string>();

  const add = (cite: string, title: string | undefined, idx: number) => {
    const key = normalizeCite(cite);
    if (seen.has(key)) return;
    seen.add(key);
    const curated = resolveCuratedByCite(cite, documentKind, rawFacts);
    const evidenceIds = evidenceIdByCitation.get(key) ?? [];
    const orphan = evidenceIds.length === 0 && !curated;
    results.push({
      id: `cite_${results.length + 1}`,
      citationKey: key,
      citationDisplay: curated ? `${curated.title} — ${curated.citation}` : cite.trim(),
      title: curated?.title ?? title,
      proposition: nearestProposition(draftText, idx),
      paragraphIndex: 0,
      issue: detectIssue(nearestProposition(draftText, idx), documentKind, legalIssues),
      evidenceIds,
      orphan,
    });
  };

  for (const m of draftText.matchAll(CASE_CITE_RE)) {
    const cite = m[0];
    const idx = m.index ?? 0;
    add(cite, undefined, idx);
  }

  for (const m of draftText.matchAll(/^\s*\d+\.\s+([^\n]+)/gm)) {
    const line = m[1];
    const cite = line.match(CASE_CITE_RE)?.[0];
    if (!cite) continue;
    const idx = (m.index ?? 0) + line.indexOf(cite);
    add(cite, line.split(cite)[0]?.trim(), idx);
  }

  for (const m of draftText.matchAll(CASE_NAME_RE)) {
    const name = m[1];
    const idx = m.index ?? 0;
    const curated = allCuratedCases(documentKind, rawFacts).find((c) =>
      c.title.toLowerCase().includes(name.toLowerCase().slice(0, 24)),
    );
    if (curated) add(curated.citation, curated.title, idx);
  }

  return results.slice(0, 24);
}
